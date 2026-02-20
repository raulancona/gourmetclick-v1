import { useState, useEffect } from 'react'
import { X, Receipt, CreditCard, Banknote, TrendingUp, Calendar, Clock, User, Armchair, Store, Truck } from 'lucide-react'
import { getSessionFinancialSummary } from '../../lib/order-service'
import { formatCurrency } from '../../lib/utils'
import { OrderDetailModal } from '../orders/order-detail-modal'

export function SessionDetailModal({ session, onClose }) {
    const [summary, setSummary] = useState(null)
    const [loading, setLoading] = useState(true)
    const [selectedOrder, setSelectedOrder] = useState(null) // For viewing order details

    useEffect(() => {
        if (session?.id) {
            getSessionFinancialSummary(session.id)
                .then(data => {
                    const enriched = {
                        ...data,
                        avgTicket: data.totalSales / (data.orders.length || 1),
                        topPayment: Object.entries(data.byPayment).sort((a, b) => b[1] - a[1])[0]?.[0]
                    }
                    setSummary(enriched)
                    setLoading(false)
                })
                .catch(err => {
                    console.error("Error fetching session summary", err)
                    setLoading(false)
                })
        }
    }, [session])

    if (!session) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <div
                className="relative bg-card w-full max-w-4xl rounded-3xl shadow-2xl max-h-[90vh] overflow-y-auto flex flex-col border border-border"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="sticky top-0 bg-card/95 backdrop-blur border-b border-border px-8 py-6 flex items-center justify-between z-10">
                    <div>
                        <h2 className="text-2xl font-black text-foreground uppercase tracking-tight">Detalle de Corte</h2>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                            <span className="font-mono">ID: {session.id.slice(0, 8)}</span>
                            <span className="w-1 h-1 rounded-full bg-border" />
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${session.estado === 'abierta' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'
                                }`}>
                                {session.estado}
                            </span>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-10 h-10 rounded-full bg-muted flex items-center justify-center hover:bg-accent transition-colors">
                        <X className="w-5 h-5 text-foreground" />
                    </button>
                </div>

                <div className="p-8 space-y-8">
                    {/* Meta Info */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-muted/30 p-4 rounded-2xl border border-border/50">
                            <div className="flex items-center gap-2 text-muted-foreground mb-2">
                                <Calendar className="w-4 h-4" />
                                <span className="text-xs font-bold uppercase tracking-wider">Apertura</span>
                            </div>
                            <p className="font-semibold text-foreground">
                                {new Date(session.opened_at).toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                            </p>
                            <p className="text-sm text-muted-foreground">
                                {new Date(session.opened_at).toLocaleTimeString()}
                            </p>
                        </div>
                        <div className="bg-muted/30 p-4 rounded-2xl border border-border/50">
                            <div className="flex items-center gap-2 text-muted-foreground mb-2">
                                <Clock className="w-4 h-4" />
                                <span className="text-xs font-bold uppercase tracking-wider">Cierre</span>
                            </div>
                            {session.closed_at ? (
                                <>
                                    <p className="font-semibold text-foreground">
                                        {new Date(session.closed_at).toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                        {new Date(session.closed_at).toLocaleTimeString()}
                                    </p>
                                </>
                            ) : (
                                <p className="text-sm font-bold text-blue-500 italic">En curso...</p>
                            )}
                        </div>
                    </div>

                    {/* Financial Summary */}
                    {loading ? (
                        <div className="py-12 flex justify-center">
                            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : summary ? (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="bg-emerald-500/5 border border-emerald-500/20 p-5 rounded-3xl">
                                    <p className="text-xs font-black text-emerald-600 uppercase tracking-widest mb-2">Ventas Totales</p>
                                    <p className="text-3xl font-black text-emerald-700">{formatCurrency(summary.totalSales)}</p>
                                </div>
                                <div className="bg-red-500/5 border border-red-500/20 p-5 rounded-3xl">
                                    <p className="text-xs font-black text-red-600 uppercase tracking-widest mb-2">Gastos</p>
                                    <p className="text-3xl font-black text-red-700">{formatCurrency(summary.totalExpenses)}</p>
                                </div>
                                <div className="bg-blue-500/5 border border-blue-500/20 p-5 rounded-3xl">
                                    <p className="text-xs font-black text-blue-600 uppercase tracking-widest mb-2">Balance Neto</p>
                                    <p className="text-3xl font-black text-blue-700">{formatCurrency(summary.totalSales - summary.totalExpenses)}</p>
                                </div>
                            </div>



                            {/* Additional KPIs */}
                            <div className="grid grid-cols-3 gap-4">
                                <div className="bg-muted/30 border border-border rounded-2xl p-4 text-center">
                                    <p className="text-[10px] font-black uppercase text-muted-foreground mb-1">Total Órdenes</p>
                                    <p className="text-xl font-black">{summary.orders.length}</p>
                                </div>
                                <div className="bg-muted/30 border border-border rounded-2xl p-4 text-center">
                                    <p className="text-[10px] font-black uppercase text-muted-foreground mb-1">Ticket Promedio</p>
                                    <p className="text-xl font-black">{formatCurrency(summary.avgTicket)}</p>
                                </div>
                                <div className="bg-muted/30 border border-border rounded-2xl p-4 text-center">
                                    <p className="text-[10px] font-black uppercase text-muted-foreground mb-1">Método Principal</p>
                                    <p className="text-xl font-black capitalize">
                                        {summary.topPayment === 'card' ? 'Tarjeta' : summary.topPayment === 'transfer' ? 'Transf.' : 'Efectivo'}
                                    </p>
                                </div>
                            </div>

                            {/* Breakdown */}
                            <div className="bg-card border border-border rounded-3xl overflow-hidden">
                                <div className="bg-muted/50 px-6 py-3 border-b border-border">
                                    <h3 className="font-bold text-sm uppercase tracking-wider text-foreground">Desglose por Método de Pago</h3>
                                </div>
                                <div className="divide-y divide-border">
                                    <div className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center text-green-600">
                                                <Banknote className="w-5 h-5" />
                                            </div>
                                            <span className="font-medium text-foreground">Efectivo</span>
                                        </div>
                                        <span className="font-bold text-lg text-foreground">{formatCurrency(summary.byPayment.cash)}</span>
                                    </div>
                                    <div className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600">
                                                <CreditCard className="w-5 h-5" />
                                            </div>
                                            <span className="font-medium text-foreground">Tarjeta</span>
                                        </div>
                                        <span className="font-bold text-lg text-foreground">{formatCurrency(summary.byPayment.card)}</span>
                                    </div>
                                    <div className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center text-purple-600">
                                                <TrendingUp className="w-5 h-5" />
                                            </div>
                                            <span className="font-medium text-foreground">Transferencia</span>
                                        </div>
                                        <span className="font-bold text-lg text-foreground">{formatCurrency(summary.byPayment.transfer)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Verification Block */}
                            {session.estado === 'cerrada' && (
                                <div className="bg-stone-100 dark:bg-stone-900 rounded-3xl p-6 border border-stone-200 dark:border-stone-800">
                                    <h3 className="font-black text-stone-600 dark:text-stone-400 uppercase tracking-widest text-xs mb-4">Auditoría de Cierre</h3>
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-muted-foreground">Fondo Inicial</span>
                                            <span className="font-mono font-bold">{formatCurrency(session.fondo_inicial)}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-muted-foreground">Esperado en Caja (Efectivo + Inicial - Gastos)</span>
                                            <span className="font-mono font-bold">{formatCurrency(session.monto_esperado)}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-muted-foreground">Reportado por Cajero</span>
                                            <span className="font-mono font-bold">{formatCurrency(session.monto_real)}</span>
                                        </div>
                                        <div className={`mt-4 pt-4 border-t border-stone-200 dark:border-stone-700 flex justify-between items-center p-3 rounded-xl ${session.diferencia === 0 ? 'bg-green-100 text-green-700' :
                                            session.diferencia > 0 ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'
                                            }`}>
                                            <span className="font-black uppercase text-xs">Diferencia Final</span>
                                            <span className="font-black text-lg">{formatCurrency(session.diferencia)}</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Orders List */}
                            {summary.orders && summary.orders.length > 0 && (
                                <div className="bg-card border border-border rounded-3xl overflow-hidden">
                                    <div className="bg-muted/50 px-6 py-3 border-b border-border flex items-center justify-between">
                                        <h3 className="font-bold text-sm uppercase tracking-wider text-foreground">
                                            Órdenes del Turno
                                        </h3>
                                        <span className="text-xs font-black text-muted-foreground">
                                            {summary.orders.length} pedidos
                                        </span>
                                    </div>
                                    <div className="divide-y divide-border">
                                        {summary.orders.map(order => {
                                            const items = Array.isArray(order.items) ? order.items : []
                                            const typeIcon = order.order_type === 'dine_in'
                                                ? <Armchair className="w-3.5 h-3.5" />
                                                : order.order_type === 'delivery'
                                                    ? <Truck className="w-3.5 h-3.5" />
                                                    : <Store className="w-3.5 h-3.5" />
                                            const paymentIcon = order.payment_method === 'card'
                                                ? <CreditCard className="w-3.5 h-3.5" />
                                                : order.payment_method === 'transfer'
                                                    ? <TrendingUp className="w-3.5 h-3.5" />
                                                    : <Banknote className="w-3.5 h-3.5" />

                                            return (
                                                <div
                                                    key={order.id}
                                                    onClick={() => setSelectedOrder(order)}
                                                    className="p-4 hover:bg-muted/40 transition-colors cursor-pointer group"
                                                >
                                                    <div className="flex items-start justify-between gap-2">
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <span className="font-bold text-sm text-foreground truncate group-hover:text-primary transition-colors">
                                                                    {order.customer_name || 'Cliente General'}
                                                                </span>
                                                                <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded-md font-mono text-muted-foreground border border-border">
                                                                    #{order.folio || order.id.slice(0, 4)}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center gap-3 text-[10px] text-muted-foreground font-medium">
                                                                <span className="flex items-center gap-1">{typeIcon}
                                                                    {order.order_type === 'dine_in' ? 'Mesa' : order.order_type === 'delivery' ? 'Domicilio' : 'Llevar'}
                                                                </span>
                                                                <span className="flex items-center gap-1">{paymentIcon}
                                                                    {order.payment_method === 'card' ? 'Tarjeta' : order.payment_method === 'transfer' ? 'Transferencia' : 'Efectivo'}
                                                                </span>
                                                                <span className="text-muted-foreground/60">
                                                                    {new Date(order.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                                                                </span>
                                                            </div>
                                                            {/* Items summary */}
                                                            {items.length > 0 && (
                                                                <div className="mt-1.5 text-[10px] text-muted-foreground">
                                                                    {items.slice(0, 3).map((item, i) => (
                                                                        <span key={i}>
                                                                            {i > 0 ? ', ' : ''}
                                                                            {item.quantity}× {item.name || item.product?.name}
                                                                        </span>
                                                                    ))}
                                                                    {items.length > 3 && <span className="text-muted-foreground/60"> +{items.length - 3} más</span>}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="text-right shrink-0">
                                                            <span className="font-black text-sm text-foreground">
                                                                {formatCurrency(order.total)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                    {/* Orders total footer */}
                                    <div className="px-6 py-3 bg-muted/30 border-t border-border flex justify-between items-center">
                                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Total del Turno</span>
                                        <span className="font-black text-primary">{formatCurrency(summary.totalSales)}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="text-center py-8 text-red-500">
                            Error al cargar datos
                        </div>
                    )}
                </div>
            </div>
            {/* Order Detail Overlay */}
            {
                selectedOrder && (
                    <div style={{ position: 'fixed', zIndex: 60 }}>
                        <OrderDetailModal
                            order={selectedOrder}
                            isAdmin={true} // Allow admin view features
                            onClose={() => setSelectedOrder(null)}
                            onUpdateStatus={() => { }} // Read only in history
                            onUpdateOrder={() => { }} // Read only in history
                            onDelete={() => { }} // Read only in history
                        />
                    </div>
                )
            }
        </div >
    )
}

