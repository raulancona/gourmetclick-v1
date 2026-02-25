import { useMemo, useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTenant } from '../features/auth/tenant-context'
import { useAuth } from '../features/auth/auth-context'
import { useTerminal } from '../features/auth/terminal-context'
import { supabase } from '../lib/supabase'
import {
    Search, Package, Clock, ChefHat, CheckCircle2, XCircle,
    RefreshCw, Lock, Shield, Banknote, CreditCard, Building2,
    Wifi, WifiOff
} from 'lucide-react'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Card, CardContent } from '../components/ui/card'
import { toast } from 'sonner'
import {
    getOrders, updateOrderStatus, updateOrder, deleteOrder,
    getOrderStats, ORDER_STATUSES, PAYMENT_METHODS, getNextStatuses
} from '../lib/order-service'
import { OrderDetailModal } from '../features/orders/order-detail-modal'

const STATUS_FILTERS = [
    { value: 'all', label: 'Todos', icon: Package },
    { value: 'active', label: 'Activos', icon: Clock },
    { value: 'delivered', label: 'Entregados', icon: CheckCircle2 },
    { value: 'cancelled', label: 'Cancelados', icon: XCircle },
]

export function OrdersPage() {
    const { tenant } = useTenant()
    const { user } = useAuth()
    const { activeEmployee } = useTerminal()
    const queryClient = useQueryClient()
    const [statusFilter, setStatusFilter] = useState('all')
    const [searchTerm, setSearchTerm] = useState('')
    const [selectedOrder, setSelectedOrder] = useState(null)
    const [isConnected, setIsConnected] = useState(true)
    const [lastUpdate, setLastUpdate] = useState(Date.now())

    const restaurantId = tenant?.id || user?.id

    // ─── Orders Query — simple useQuery, no pagination ────────────────────────
    // Returns raw {data: [], count} — NO select transform to avoid optimistic update crash
    const { data: ordersRaw, isLoading, refetch } = useQuery({
        queryKey: ['orders-live', restaurantId],
        queryFn: () => getOrders(restaurantId, {
            includeClosed: false,
            pageSize: 500
        }),
        enabled: !!restaurantId,
        refetchInterval: 8_000,
    })

    const allOrders = ordersRaw?.data || []

    // ─── Stats Query ──────────────────────────────────────────────────────────
    const { data: stats } = useQuery({
        queryKey: ['order-stats-live', restaurantId],
        queryFn: () => getOrderStats(restaurantId, { filterByShift: false }),
        enabled: !!restaurantId,
        refetchInterval: 10_000,
    })

    // ─── Realtime WebSocket — single clean subscription ───────────────────────
    useEffect(() => {
        if (!restaurantId) return

        const channel = supabase
            .channel(`orders-live-${restaurantId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'orders',
                    // NOTE: No filter here — row-level filters fail silently with RLS.
                    // We filter client-side using restaurantId after receiving the event.
                },
                (payload) => {
                    // Only react to events for THIS restaurant
                    const orderId = payload.new?.restaurant_id || payload.old?.restaurant_id
                    if (orderId && orderId !== restaurantId) return

                    console.log('⚡ Order update:', payload.eventType)
                    setLastUpdate(Date.now())

                    queryClient.invalidateQueries({ queryKey: ['orders-live', restaurantId] })
                    queryClient.invalidateQueries({ queryKey: ['order-stats-live', restaurantId] })

                    if (payload.eventType === 'INSERT') {
                        try {
                            const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3')
                            audio.play().catch(() => { })
                        } catch { }
                        toast.success(`🔔 ¡Nueva orden! ${payload.new?.customer_name || 'Cliente General'}`, { duration: 6000 })
                    }
                }
            )
            .subscribe((status) => {
                const connected = status === 'SUBSCRIBED'
                setIsConnected(connected)
                console.log('🔌 Realtime status:', status)
            })

        return () => {
            supabase.removeChannel(channel)
        }
    }, [restaurantId, queryClient])

    // ─── Filtered Orders ──────────────────────────────────────────────────────
    const filteredOrders = useMemo(() => {
        return allOrders.filter(order => {
            const matchesSearch = !searchTerm ||
                order.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                order.id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                String(order.folio || '').includes(searchTerm)

            let matchesFilter = true
            if (statusFilter === 'active')
                matchesFilter = ['pending', 'confirmed', 'preparing', 'ready', 'on_the_way'].includes(order.status)
            else if (statusFilter === 'delivered')
                matchesFilter = order.status === 'delivered'
            else if (statusFilter === 'cancelled')
                matchesFilter = order.status === 'cancelled'

            return matchesSearch && matchesFilter
        })
    }, [allOrders, searchTerm, statusFilter])

    // ─── Mutations ────────────────────────────────────────────────────────────
    const updateStatusMutation = useMutation({
        mutationFn: ({ orderId, status }) => updateOrderStatus(orderId, status, restaurantId),
        onMutate: async ({ orderId, status }) => {
            // Optimistic update — instantly reflect change in UI  
            // NOTE: queryData has shape {data: [], count: N} because we don't use select transform
            await queryClient.cancelQueries({ queryKey: ['orders-live', restaurantId] })
            const prev = queryClient.getQueryData(['orders-live', restaurantId])
            queryClient.setQueryData(['orders-live', restaurantId], (old) => {
                if (!old?.data) return old
                return {
                    ...old,
                    data: old.data.map(o => o.id === orderId ? { ...o, status } : o)
                }
            })
            return { prev }
        },
        onError: (err, _, ctx) => {
            if (ctx?.prev) queryClient.setQueryData(['orders-live', restaurantId], ctx.prev)
            toast.error(err.message || 'Error al actualizar')
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['orders-live', restaurantId] })
            queryClient.invalidateQueries({ queryKey: ['order-stats-live', restaurantId] })
        }
    })

    const updateOrderMutation = useMutation({
        mutationFn: ({ orderId, updates }) => updateOrder(orderId, updates, restaurantId),
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['orders-live', restaurantId] })
            setSelectedOrder(data)
            toast.success('Orden actualizada')
        },
        onError: (error) => toast.error(error.message || 'Error al actualizar'),
    })

    const deleteMutation = useMutation({
        mutationFn: (orderId) => deleteOrder(orderId, restaurantId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['orders-live', restaurantId] })
            queryClient.invalidateQueries({ queryKey: ['order-stats-live', restaurantId] })
            setSelectedOrder(null)
            toast.success('Orden eliminada')
        },
        onError: (error) => toast.error(error.message || 'Error al eliminar'),
    })

    const getTimeAgo = (dateStr) => {
        const diff = Date.now() - new Date(dateStr).getTime()
        const mins = Math.floor(diff / 60000)
        if (mins < 1) return 'Ahora'
        if (mins < 60) return `${mins}m`
        const hrs = Math.floor(mins / 60)
        if (hrs < 24) return `${hrs}h`
        return `${Math.floor(hrs / 24)}d`
    }

    const isAdmin = !activeEmployee || activeEmployee.rol === 'admin'
    const PAYMENT_LABELS = PAYMENT_METHODS

    return (
        <div className="p-4 sm:p-6 max-w-6xl mx-auto pb-20">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-black text-foreground tracking-tight">Órdenes</h1>
                    <div className="flex items-center gap-2 mt-1">
                        <p className="text-muted-foreground text-sm">Gestiona y da seguimiento a los pedidos</p>
                        {/* Realtime status indicator */}
                        <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${isConnected ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                            {isConnected
                                ? <><Wifi className="w-2.5 h-2.5" /> EN VIVO</>
                                : <><WifiOff className="w-2.5 h-2.5" /> DESCONECTADO</>
                            }
                        </span>
                    </div>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                        refetch()
                        queryClient.invalidateQueries({ queryKey: ['orders-live'] })
                        queryClient.invalidateQueries({ queryKey: ['order-stats-live'] })
                        toast.info('Actualizando...')
                    }}
                    className="shrink-0"
                >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Actualizar
                </Button>
            </div>

            {/* Stats Cards */}
            {stats && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
                    {[
                        { label: 'Total', value: stats.total, color: '#6B7280', icon: Package },
                        { label: 'Pendientes', value: stats.pending, color: '#F59E0B', icon: Clock },
                        { label: 'Activos', value: stats.active, color: '#3B82F6', icon: ChefHat },
                        { label: 'Entregados', value: stats.delivered, color: '#22C55E', icon: CheckCircle2 },
                        { label: 'Ingresos', value: `$${(stats.revenue || 0).toFixed(0)}`, color: '#10B981', icon: CreditCard },
                    ].map((stat, i) => (
                        <Card key={i} className="border border-border shadow-sm">
                            <CardContent className="p-4 flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${stat.color}20` }}>
                                    <stat.icon className="w-5 h-5" style={{ color: stat.color }} />
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                                    <p className="text-lg font-black">{stat.value}</p>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar por nombre o ID..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="pl-9"
                    />
                </div>
                <div className="flex gap-1 bg-muted rounded-xl p-1">
                    {STATUS_FILTERS.map(f => (
                        <button
                            key={f.value}
                            onClick={() => setStatusFilter(f.value)}
                            className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${statusFilter === f.value
                                ? 'bg-background shadow-sm text-foreground'
                                : 'text-muted-foreground hover:text-foreground'
                                }`}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Orders count */}
            <p className="text-xs text-muted-foreground font-medium mb-3">
                {filteredOrders.length === 0 ? 'Sin órdenes' : `${filteredOrders.length} orden${filteredOrders.length !== 1 ? 'es' : ''}`}
                {searchTerm && ` para "${searchTerm}"`}
            </p>

            {/* Orders List — simple list, no virtualizer */}
            <div className="space-y-3">
                {isLoading ? (
                    <div className="text-center py-16">
                        <div className="w-10 h-10 border-4 border-muted border-t-primary rounded-full animate-spin mx-auto mb-4" />
                        <p className="text-muted-foreground font-medium">Cargando órdenes...</p>
                    </div>
                ) : filteredOrders.length === 0 ? (
                    <div className="text-center py-16">
                        <Package className="w-14 h-14 mx-auto mb-4 text-muted-foreground/30" />
                        <p className="text-muted-foreground font-bold text-lg">
                            {statusFilter === 'all' && !searchTerm ? 'No hay órdenes activas' : 'No se encontraron órdenes'}
                        </p>
                        <p className="text-muted-foreground/60 text-sm mt-1">
                            {statusFilter === 'all' && !searchTerm ? 'Las nuevas órdenes aparecerán aquí en tiempo real.' : 'Prueba con otro filtro o búsqueda.'}
                        </p>
                    </div>
                ) : (
                    filteredOrders.map(order => {
                        const statusInfo = ORDER_STATUSES[order.status] || ORDER_STATUSES.pending
                        const payment = PAYMENT_LABELS[order.payment_method] || PAYMENT_LABELS.cash
                        const items = Array.isArray(order.items) ? order.items : []
                        const isActive = ['pending', 'confirmed', 'preparing', 'ready', 'on_the_way'].includes(order.status)
                        const isPending = order.status === 'pending'

                        return (
                            <div
                                key={order.id}
                                onClick={() => setSelectedOrder(order)}
                                className={`bg-card border rounded-2xl p-4 cursor-pointer transition-all hover:shadow-md active:scale-[0.99] ${isPending ? 'border-amber-300 dark:border-amber-700 bg-amber-50/30 dark:bg-amber-900/10 shadow-amber-100 dark:shadow-amber-900/20 shadow-sm' : 'border-border hover:border-primary/30'}`}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap mb-1">
                                            <span className="font-black text-foreground">{order.customer_name || 'Cliente General'}</span>
                                            <span
                                                className="text-xs font-bold px-2 py-0.5 rounded-full text-white shrink-0"
                                                style={{ background: statusInfo.color }}
                                            >
                                                {statusInfo.emoji} {statusInfo.label}
                                            </span>
                                        </div>
                                        <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                            <span>
                                                {order.order_type === 'delivery' ? '🛵 Envío' :
                                                    order.order_type === 'dine_in' ? '🪑 Mesa' : '🏪 Recoger'}
                                            </span>
                                            {order.table_number && (
                                                <span className="font-black text-orange-500">Mesa #{order.table_number}</span>
                                            )}
                                            <span className="flex items-center gap-1">
                                                {payment.icon} {payment.label}
                                            </span>
                                            {order.cash_cut_id && (
                                                <span className="text-[10px] bg-stone-100 dark:bg-stone-800 text-stone-500 px-1.5 py-0.5 rounded font-bold flex items-center gap-0.5 border border-stone-200 dark:border-stone-700">
                                                    <Lock className="w-2.5 h-2.5" /> Cortado
                                                </span>
                                            )}
                                            <span className="font-mono text-muted-foreground/60">#{order.folio || order.id.slice(0, 6)}</span>
                                        </div>
                                        {items.length > 0 && (
                                            <p className="text-xs text-muted-foreground/70 mt-1.5 truncate">
                                                {items.slice(0, 3).map(i => `${i.quantity || 1}x ${i.product?.name || i.name || '?'}`).join(' · ')}
                                                {items.length > 3 && ` +${items.length - 3} más`}
                                            </p>
                                        )}
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className="font-black text-foreground text-lg">${parseFloat(order.total || 0).toFixed(2)}</p>
                                        <p className="text-xs text-muted-foreground">{getTimeAgo(order.created_at)}</p>
                                    </div>
                                </div>

                                {/* Quick Action Buttons — only for active orders */}
                                {isActive && (
                                    <div className="flex gap-2 mt-3 pt-3 border-t border-border/50">
                                        {getNextStatuses(order.status).map(next => {
                                            const nextInfo = ORDER_STATUSES[next]
                                            if (!nextInfo) return null
                                            return (
                                                <button
                                                    key={next}
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        updateStatusMutation.mutate({ orderId: order.id, status: next })
                                                    }}
                                                    className="flex-1 py-2 rounded-xl text-xs font-black text-white transition-all hover:opacity-90 active:scale-95 shadow-sm"
                                                    style={{ background: nextInfo.color }}
                                                >
                                                    {nextInfo.emoji} {nextInfo.label}
                                                </button>
                                            )
                                        })}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                updateStatusMutation.mutate({ orderId: order.id, status: 'cancelled' })
                                            }}
                                            className="px-3 py-2 rounded-xl text-xs font-bold text-red-600 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 transition-all active:scale-95"
                                        >
                                            ❌
                                        </button>
                                    </div>
                                )}
                            </div>
                        )
                    })
                )}
            </div>

            {/* Order Detail Modal */}
            {selectedOrder && (
                <OrderDetailModal
                    order={selectedOrder}
                    isAdmin={isAdmin}
                    onClose={() => setSelectedOrder(null)}
                    onUpdateStatus={(status) => {
                        updateStatusMutation.mutate({ orderId: selectedOrder.id, status })
                        setSelectedOrder({ ...selectedOrder, status })
                    }}
                    onUpdateOrder={(updates) => updateOrderMutation.mutate({ orderId: selectedOrder.id, updates })}
                    onDelete={() => deleteMutation.mutate(selectedOrder.id)}
                />
            )}
        </div>
    )
}
