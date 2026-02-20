import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../features/auth/auth-context'
import { getUnclosedOrders, createCashCut, updateOrderStatus, updateOrder, deleteOrder, getActiveSession } from '../lib/order-service'
import { generateClosingSummary, sendWhatsAppOrder } from '../lib/whatsapp-service'
import { OrderDetailModal } from '../features/orders/order-detail-modal'
import { BlindCashCut } from '../features/cash-closing/blind-cash-cut'
import { OpenSession } from '../features/cash-closing/open-session'
import { CortesHistory } from '../features/cash-closing/cortes-history'
import { useTerminal } from '../features/auth/terminal-context'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card'
import { Button } from '../components/ui/button'
import {
    Calculator, Banknote, CreditCard, Landmark,
    ArrowRight, Loader2, CheckCircle2, ShoppingBag,
    TrendingUp, Send, History, LayoutPanelLeft, ShieldCheck,
} from 'lucide-react'
import { toast } from 'sonner'
import { formatCurrency } from '../lib/utils'

import { ExpenseManager } from '../features/expenses/expense-manager'
import { supabase } from '../lib/supabase'

export function CashClosingPage() {
    const { user } = useAuth()
    const { activeEmployee } = useTerminal()
    const queryClient = useQueryClient()
    const [view, setView] = useState('closing') // 'closing', 'history', 'expenses'
    const [selectedOrder, setSelectedOrder] = useState(null)

    // Admin if no terminal session (direct owner) or terminal role is admin
    const isAdmin = !activeEmployee || activeEmployee.rol === 'admin'

    const { data: orders = [], isLoading: loadingOrders } = useQuery({
        queryKey: ['unclosed-orders', user?.id],
        queryFn: () => getUnclosedOrders(user.id),
        enabled: !!user?.id,
        refetchInterval: 30_000, // Polling fallback every 30s
    })

    const { data: activeSession, isLoading: loadingSession } = useQuery({
        queryKey: ['active-session', user?.id],
        queryFn: () => getActiveSession(user.id),
        enabled: !!user?.id,
        refetchInterval: 30_000,
    })

    // Realtime: session changes + order status changes
    useEffect(() => {
        if (!user?.id) return

        const sessionChannel = supabase
            .channel(`session-sync-${user.id}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'sesiones_caja', filter: `restaurante_id=eq.${user.id}` },
                () => {
                    queryClient.invalidateQueries(['active-session'])
                    queryClient.invalidateQueries(['sessions-history'])
                }
            )
            .subscribe()

        // Also listen to order changes so the panel auto-updates when waiter
        // changes a status from the POS without needing manual refresh
        const ordersChannel = supabase
            .channel(`caja-orders-${user.id}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'orders', filter: `user_id=eq.${user.id}` },
                () => {
                    queryClient.invalidateQueries(['unclosed-orders'])
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(sessionChannel)
            supabase.removeChannel(ordersChannel)
        }
    }, [user?.id, queryClient])

    const onCutComplete = () => {
        queryClient.invalidateQueries(['unclosed-orders'])
        queryClient.invalidateQueries(['active-session'])
        queryClient.invalidateQueries(['cortes-history'])
        queryClient.invalidateQueries(['sessions-history'])
        // Stay on closing view (history is now in Reports page)
    }

    if (loadingOrders || loadingSession) {
        return <div className="p-8 h-[400px] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
    }

    return (
        <div className="p-4 lg:p-8 max-w-5xl mx-auto space-y-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-4xl font-black text-foreground tracking-tight">Módulo Financiero</h1>
                    <p className="text-muted-foreground font-medium">Control de cierres y auditoría de caja</p>
                </div>

                {isAdmin && (
                    <div className="flex p-1 bg-muted rounded-2xl border border-border w-fit">
                        <Button
                            variant={view === 'closing' ? 'default' : 'ghost'}
                            onClick={() => setView('closing')}
                            className="rounded-xl font-bold h-10 px-4"
                        >
                            <LayoutPanelLeft className="w-4 h-4 mr-2" /> Corte Actual
                        </Button>
                        <Button
                            variant={view === 'expenses' ? 'default' : 'ghost'}
                            onClick={() => setView('expenses')}
                            className="rounded-xl font-bold h-10 px-4"
                        >
                            <Banknote className="w-4 h-4 mr-2" /> Gastos
                        </Button>
                    </div>
                )}
            </div>

            {/* Live View Status Bar */}
            <div className="flex flex-wrap gap-4 items-center bg-card border border-border/50 p-4 rounded-2xl shadow-sm">
                <div className="flex items-center gap-3 pr-4 border-r border-border">
                    <span className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">Estatus Turno</span>
                    {activeSession ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 text-xs font-black uppercase tracking-wide border border-emerald-500/20">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            Abierto
                        </span>
                    ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gray-500/10 text-gray-600 text-xs font-black uppercase tracking-wide border border-gray-500/20">
                            <span className="w-2 h-2 rounded-full bg-gray-400" />
                            Cerrado
                        </span>
                    )}
                </div>

                {activeSession && (
                    <div className="flex items-center gap-3">
                        <span className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">Cajero en Turno</span>
                        <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                                {(activeSession.empleado?.nombre || 'Admin').charAt(0)}
                            </div>
                            <span className="font-bold text-sm">{activeSession.empleado?.nombre || 'Administrador'}</span>
                        </div>
                    </div>
                )}
            </div>

            {view === 'closing' ? (
                <div className="grid lg:grid-cols-5 gap-8 items-start">
                    {/* Main Cut Component - 60% */}
                    <div className="lg:col-span-3">
                        {activeSession ? (
                            <BlindCashCut onComplete={onCutComplete} session={activeSession} isAdmin={isAdmin} orders={orders} />
                        ) : (
                            <OpenSession onComplete={onCutComplete} />
                        )}
                    </div>

                    {/* Secondary Info (Only for Admin) or Instructions */}
                    <div className="lg:col-span-2 space-y-6">
                        {isAdmin ? (
                            <Card className="border-border shadow-sm rounded-3xl overflow-hidden">
                                <CardHeader className="bg-primary/5 border-b border-primary/10">
                                    <div className="flex items-center gap-2 mb-1">
                                        <ShieldCheck className="w-4 h-4 text-primary" />
                                        <span className="text-[10px] font-black uppercase text-primary tracking-widest">Panel de Control Admin</span>
                                    </div>
                                    <CardTitle className="text-lg">Revision de Órdenes</CardTitle>
                                    <CardDescription>Pendientes de liquidación hoy</CardDescription>
                                </CardHeader>
                                <CardContent className="p-4 overflow-y-auto max-h-[500px] space-y-2">
                                    {orders.map(order => (
                                        <div
                                            key={order.id}
                                            className="p-3 border border-border rounded-xl flex items-center justify-between bg-card cursor-pointer hover:bg-muted/30 transition-colors"
                                            onClick={() => setSelectedOrder(order)}
                                        >
                                            <div>
                                                <div className="text-xs font-bold text-foreground">{order.customer_name || 'Cliente'}</div>
                                                <div className="text-[9px] text-muted-foreground font-mono uppercase italic">{new Date(order.created_at).toLocaleTimeString()}</div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-xs font-bold text-foreground">{formatCurrency(order.total)}</div>
                                                <div className="text-[9px] text-primary font-black uppercase tracking-tighter">{order.payment_method}</div>
                                            </div>
                                        </div>
                                    ))}
                                    {orders.length === 0 && (
                                        <div className="py-12 text-center text-muted-foreground italic">
                                            <CheckCircle2 className="w-8 h-8 mx-auto mb-2 opacity-20" />
                                            <p className="text-xs font-bold">Sin órdenes pendientes</p>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        ) : (
                            <div className="space-y-4">
                                <div className="p-6 bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/50 rounded-3xl">
                                    <h3 className="font-black text-blue-900 dark:text-blue-400 mb-2 uppercase text-xs tracking-widest">Procedimiento Seguro</h3>
                                    <p className="text-xs text-blue-800 dark:text-blue-500 font-medium leading-relaxed">
                                        1. Cuenta todo el efectivo de la caja.<br />
                                        2. No incluyas el fondo de caja inicial.<br />
                                        3. Ingresa el monto exacto en el panel.<br />
                                        4. El sistema calculará automáticamente si falta o sobra dinero.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            ) : view === 'expenses' ? (
                <ExpenseManager />
            ) : (
                <CortesHistory />
            )}

            {selectedOrder && (
                <OrderDetailModal
                    order={selectedOrder}
                    onClose={() => setSelectedOrder(null)}
                    onUpdateStatus={async (status) => {
                        try {
                            // Legacy update logic remains here
                            setSelectedOrder({ ...selectedOrder, status })
                            queryClient.invalidateQueries(['unclosed-orders'])
                        } catch (err) {
                            toast.error('Error al actualizar')
                        }
                    }}
                    onDelete={async () => {
                        setSelectedOrder(null)
                        queryClient.invalidateQueries(['unclosed-orders'])
                    }}
                />
            )}
        </div>
    )
}

