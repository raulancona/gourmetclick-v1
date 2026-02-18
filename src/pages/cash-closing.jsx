import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../features/auth/auth-context'
import { getUnclosedOrders, createCashCut, updateOrderStatus, updateOrder, deleteOrder } from '../lib/order-service'
import { generateClosingSummary, sendWhatsAppOrder } from '../lib/whatsapp-service'
import { OrderDetailModal } from '../features/orders/order-detail-modal'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card'
import { Button } from '../components/ui/button'
import {
    Calculator, Banknote, CreditCard, Landmark,
    ArrowRight, Loader2, CheckCircle2, ShoppingBag,
    TrendingUp, Send
} from 'lucide-react'
import { toast } from 'sonner'
import { formatCurrency } from '../lib/utils'

export function CashClosingPage() {
    const { user } = useAuth()
    const queryClient = useQueryClient()
    const [isClosing, setIsClosing] = useState(false)
    const [selectedOrder, setSelectedOrder] = useState(null)


    const { data: orders = [], isLoading } = useQuery({
        queryKey: ['unclosed-orders', user?.id],
        queryFn: () => getUnclosedOrders(user.id),
        enabled: !!user?.id
    })

    const summary = orders.reduce((acc, order) => {
        const total = parseFloat(order.total || 0)
        acc.totalSales += total
        acc.totalOrders += 1

        if (order.payment_method === 'cash') acc.byPayment.cash += total
        else if (order.payment_method === 'card') acc.byPayment.card += total
        else if (order.payment_method === 'transfer') acc.byPayment.transfer += total

        return acc
    }, {
        totalSales: 0,
        totalOrders: 0,
        byPayment: { cash: 0, card: 0, transfer: 0 }
    })

    const handlePerformClosing = async () => {
        if (orders.length === 0) {
            toast.error('No hay órdenes pendientes de cierre')
            return
        }

        if (!confirm('¿Estás seguro de realizar el corte de caja? Se marcarán todas las órdenes actuales como cerradas y el contador del dashboard volverá a cero.')) {
            return
        }

        try {
            setIsClosing(true)
            const orderIds = orders.map(o => o.id)

            // Create the record and link orders
            await createCashCut(user.id, summary, orderIds)

            toast.success('Corte de caja realizado con éxito')

            // Generate and suggest WhatsApp summary
            const message = generateClosingSummary('Gourmet Click', {
                ...summary,
                date: new Date().toISOString()
            })

            // Ask user if they want to send it now
            if (confirm('¿Deseas enviar el resumen del corte por WhatsApp al administrador?')) {
                sendWhatsAppOrder('', message)
            }

            queryClient.invalidateQueries(['unclosed-orders'])
            queryClient.invalidateQueries(['order-stats'])
            queryClient.invalidateQueries(['recent-orders'])
            queryClient.invalidateQueries(['orders'])
        } catch (error) {
            console.error('Error closing cash:', error)
            toast.error('Error al realizar el corte: ' + error.message)
        } finally {
            setIsClosing(false)
        }
    }

    if (isLoading) {
        return <div className="p-8 h-[400px] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
    }

    return (
        <div className="p-4 lg:p-8 max-w-4xl mx-auto space-y-8">
            <div>
                <h1 className="text-3xl font-black text-foreground">Corte de Caja</h1>
                <p className="text-muted-foreground">Reconciliación de ventas diarias y cierre administrativo</p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
                <Card className="bg-primary/5 border-primary/10">
                    <CardHeader className="pb-2">
                        <CardDescription className="font-bold flex items-center gap-2">
                            <TrendingUp className="w-4 h-4" /> Ventas a Cerrar
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black text-primary">{formatCurrency(summary.totalSales)}</div>
                    </CardContent>
                </Card>

                <Card className="bg-muted/50 border-none">
                    <CardHeader className="pb-2">
                        <CardDescription className="font-bold flex items-center gap-2 text-muted-foreground">
                            <ShoppingBag className="w-4 h-4" /> Tickets
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black text-foreground">{summary.totalOrders}</div>
                    </CardContent>
                </Card>

                <div className="flex items-center">
                    <Button
                        size="lg"
                        className="w-full h-full rounded-2xl bg-primary text-primary-foreground font-black text-lg py-6 shadow-xl shadow-primary/20 hover:scale-[1.02] transition-transform"
                        onClick={handlePerformClosing}
                        disabled={isClosing || orders.length === 0}
                    >
                        {isClosing ? <Loader2 className="w-6 h-6 animate-spin" /> : 'Realizar Corte'}
                        <ArrowRight className="w-6 h-6 ml-2" />
                    </Button>
                </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-8">
                {/* Breakdown */}
                <Card className="border-border/50 shadow-sm overflow-hidden">
                    <CardHeader className="bg-muted/30">
                        <CardTitle className="text-lg">Desglose por Pago</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-4">
                        <div className="flex items-center justify-between p-4 rounded-xl bg-green-50/50 dark:bg-green-900/10 border border-green-100 dark:border-green-900/20">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-green-100 dark:bg-green-900/30 text-green-600 rounded-lg"><Banknote className="w-5 h-5" /></div>
                                <span className="font-bold">Efectivo</span>
                            </div>
                            <span className="text-xl font-black">{formatCurrency(summary.byPayment.cash)}</span>
                        </div>

                        <div className="flex items-center justify-between p-4 rounded-xl bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/20">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-lg"><CreditCard className="w-5 h-5" /></div>
                                <span className="font-bold">Tarjeta</span>
                            </div>
                            <span className="text-xl font-black">{formatCurrency(summary.byPayment.card)}</span>
                        </div>

                        <div className="flex items-center justify-between p-4 rounded-xl bg-purple-50/50 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-900/20">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-purple-100 dark:bg-purple-900/30 text-purple-600 rounded-lg"><Landmark className="w-5 h-5" /></div>
                                <span className="font-bold">Transferencia</span>
                            </div>
                            <span className="text-xl font-black">{formatCurrency(summary.byPayment.transfer)}</span>
                        </div>
                    </CardContent>
                </Card>

                {/* Orders List for Review */}
                <Card className="border-border/50 shadow-sm flex flex-col">
                    <CardHeader>
                        <CardTitle className="text-lg">Órdenes a liquidar</CardTitle>
                        <CardDescription>Ultimos movimientos sin cerrar</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 overflow-y-auto max-h-[400px] space-y-3">
                        {orders.map(order => (
                            <div
                                key={order.id}
                                className="p-3 border border-border rounded-xl flex items-center justify-between bg-card cursor-pointer hover:bg-muted/30 transition-colors"
                                onClick={() => setSelectedOrder(order)}
                            >
                                <div>
                                    <div className="text-sm font-bold text-foreground">{order.customer_name || 'Cliente'}</div>
                                    <div className="text-[10px] text-muted-foreground font-mono uppercase">ID: {order.id.slice(0, 8)} • {new Date(order.created_at).toLocaleTimeString()}</div>
                                </div>
                                <div className="text-right">
                                    <div className="text-sm font-black text-foreground">{formatCurrency(order.total)}</div>
                                    <div className="text-[10px] text-muted-foreground uppercase">{order.payment_method}</div>
                                </div>
                            </div>
                        ))}
                        {orders.length === 0 && (
                            <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-12 text-center">
                                <CheckCircle2 className="w-12 h-12 mb-4 opacity-20" />
                                <p className="text-sm font-bold">Todo al día</p>
                                <p className="text-xs">No hay ventas pendientes de cierre.</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {selectedOrder && (
                <OrderDetailModal
                    order={selectedOrder}
                    onClose={() => setSelectedOrder(null)}
                    onUpdateStatus={async (status) => {
                        try {
                            await updateOrderStatus(selectedOrder.id, status, user.id)
                            toast.success('Estado actualizado')
                            setSelectedOrder({ ...selectedOrder, status })
                            queryClient.invalidateQueries(['unclosed-orders'])
                        } catch (err) {
                            toast.error('Error al actualizar')
                        }
                    }}
                    onUpdateOrder={async (updates) => {
                        try {
                            await updateOrder(selectedOrder.id, updates, user.id)
                            toast.success('Orden actualizada')
                            setSelectedOrder({ ...selectedOrder, ...updates })
                            queryClient.invalidateQueries(['unclosed-orders'])
                        } catch (err) {
                            toast.error('Error al actualizar')
                        }
                    }}
                    onDelete={async () => {
                        try {
                            await deleteOrder(selectedOrder.id, user.id)
                            toast.success('Orden eliminada')
                            setSelectedOrder(null)
                            queryClient.invalidateQueries(['unclosed-orders'])
                        } catch (err) {
                            toast.error('Error al eliminar')
                        }
                    }}
                />
            )}
        </div>
    )
}

