import { useMemo, useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTenant } from '../features/auth/tenant-context'
import { useAuth } from '../features/auth/auth-context'
import { useTerminal } from '../features/auth/terminal-context'
import { supabase } from '../lib/supabase'
import {
    Search, Package, Clock, ChefHat, CheckCircle2, XCircle,
    RefreshCw, Lock, CreditCard, Wifi, WifiOff, Flame, Archive, ChevronDown, AlertTriangle
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
import { formatCurrency } from '../lib/utils'

export function OrdersPage() {
    const { tenant } = useTenant()
    const { user } = useAuth()
    const { activeEmployee } = useTerminal()
    const queryClient = useQueryClient()

    // UI State
    const [activeTab, setActiveTab] = useState('activas') // 'activas' | 'historial'
    const [searchTerm, setSearchTerm] = useState('')
    const [selectedOrder, setSelectedOrder] = useState(null)
    const [isConnected, setIsConnected] = useState(true)
    const [lastUpdate, setLastUpdate] = useState(Date.now())
    const [historyPageSize, setHistoryPageSize] = useState(50)

    const restaurantId = tenant?.id || user?.id

    // ─── Active Orders Query ──────────────────────────────────────────────────
    const { data: activeOrdersRaw, isLoading: isLoadingActive, refetch: refetchActive } = useQuery({
        queryKey: ['orders-live', restaurantId],
        queryFn: () => getOrders(restaurantId, {
            includeClosed: false,
            pageSize: 500
        }),
        enabled: !!restaurantId,
        refetchInterval: 8_000,
    })

    // ─── History Orders Query ─────────────────────────────────────────────────
    const { data: historyOrdersRaw, isLoading: isLoadingHistory, refetch: refetchHistory } = useQuery({
        queryKey: ['orders-history', restaurantId, historyPageSize],
        queryFn: () => getOrders(restaurantId, {
            includeClosed: true,
            pageSize: historyPageSize
        }),
        enabled: !!restaurantId && activeTab === 'historial',
        refetchInterval: 15_000,
    })

    const allOrders = activeTab === 'activas' ? (activeOrdersRaw?.data || []) : (historyOrdersRaw?.data || [])
    const totalHistoryCount = historyOrdersRaw?.count || 0
    const isLoading = activeTab === 'activas' ? isLoadingActive : isLoadingHistory

    const refetchAll = () => {
        refetchActive()
        refetchHistory()
    }

    // ─── Stats Query ──────────────────────────────────────────────────────────
    const { data: stats } = useQuery({
        queryKey: ['order-stats-live', restaurantId],
        queryFn: () => getOrderStats(restaurantId, { filterByShift: false }),
        enabled: !!restaurantId,
        refetchInterval: 10_000,
    })

    // ─── Realtime WebSocket ───────────────────────────────────────────────────
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
                },
                (payload) => {
                    const orderId = payload.new?.restaurant_id || payload.old?.restaurant_id
                    if (orderId && orderId !== restaurantId) return

                    console.log('⚡ Order update:', payload.eventType)
                    setLastUpdate(Date.now())

                    queryClient.invalidateQueries({ queryKey: ['orders-live', restaurantId] })
                    queryClient.invalidateQueries({ queryKey: ['orders-history', restaurantId] })
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

            const isActiveStatus = ['pending', 'confirmed', 'preparing', 'ready', 'on_the_way'].includes(order.status)
            const isHistoryStatus = ['delivered', 'cancelled', 'completed'].includes(order.status)

            const matchesTab = activeTab === 'activas' ? isActiveStatus : isHistoryStatus

            return matchesSearch && matchesTab
        })
    }, [allOrders, searchTerm, activeTab])

    // ─── Mutations ────────────────────────────────────────────────────────────
    const getUserName = () => activeEmployee?.nombre || user?.email || 'Sistema'

    const updateStatusMutation = useMutation({
        mutationFn: ({ orderId, status }) => updateOrderStatus(orderId, status, restaurantId, getUserName()),
        onMutate: async ({ orderId, status }) => {
            await queryClient.cancelQueries({ queryKey: ['orders-live', restaurantId] })
            await queryClient.cancelQueries({ queryKey: ['orders-history', restaurantId] })
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
            queryClient.invalidateQueries({ queryKey: ['orders-history', restaurantId] })
            queryClient.invalidateQueries({ queryKey: ['order-stats-live', restaurantId] })
        }
    })

    const updateOrderMutation = useMutation({
        mutationFn: ({ orderId, updates }) => updateOrder(orderId, updates, restaurantId, getUserName()),
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['orders-live', restaurantId] })
            queryClient.invalidateQueries({ queryKey: ['orders-history', restaurantId] })
            setSelectedOrder(data)
            toast.success('Orden actualizada')
        },
        onError: (error) => toast.error(error.message || 'Error al actualizar'),
    })

    const deleteMutation = useMutation({
        mutationFn: (orderId) => deleteOrder(orderId, restaurantId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['orders-live', restaurantId] })
            queryClient.invalidateQueries({ queryKey: ['orders-history', restaurantId] })
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

    // Dynamic Stats selection based on active tab
    const getTabStats = () => {
        if (!stats) return []
        if (activeTab === 'activas') {
            return [
                { label: 'En Cola', value: stats.active + stats.pending, color: '#3B82F6', icon: Package },
                { label: 'Pendientes', value: stats.pending, color: '#F59E0B', icon: Clock },
                { label: 'Activos', value: stats.active, color: '#3B82F6', icon: ChefHat },
            ]
        } else {
            return [
                { label: 'Completadas', value: stats.delivered, color: '#22C55E', icon: CheckCircle2 },
                { label: 'Desperdicio/Cancel.', value: (allOrders.filter(o => o.status === 'cancelled').length) || 0, color: '#EF4444', icon: XCircle },
                { label: 'Ingresos (Histórico)', value: formatCurrency(stats.revenue || 0), color: '#10B981', icon: CreditCard },
            ]
        }
    }

    const tabStats = getTabStats()

    return (
        <div className="p-4 sm:p-6 max-w-6xl mx-auto pb-20">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-black text-foreground tracking-tight">Órdenes</h1>
                    <div className="flex items-center gap-2 mt-2">
                        {/* Realtime status indicator */}
                        <span className={`flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full ${isConnected ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'}`}>
                            {isConnected
                                ? <><Wifi className="w-3 h-3" /> EN VIVO</>
                                : <><WifiOff className="w-3 h-3" /> DESCONECTADO</>
                            }
                        </span>
                        <p className="text-muted-foreground text-sm font-medium">Sincronización automática de pedidos</p>
                    </div>
                </div>
                <Button
                    variant="outline"
                    onClick={() => {
                        refetchAll()
                        toast.info('Actualizando...')
                    }}
                    className="shrink-0 h-10 rounded-xl font-bold bg-card shadow-sm hover:shadow-md transition-all"
                >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Sincronizar Manual
                </Button>
            </div>

            {/* Dual Tabs */}
            <div className="flex gap-2 p-1.5 bg-muted/50 rounded-2xl mb-6">
                <button
                    onClick={() => setActiveTab('activas')}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-black text-sm transition-all ${activeTab === 'activas'
                        ? 'bg-background shadow-md text-foreground scale-[1.01]'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                        }`}
                >
                    <Flame className={`w-4 h-4 ${activeTab === 'activas' ? 'text-orange-500' : ''}`} />
                    Operación Activa
                </button>
                <button
                    onClick={() => setActiveTab('historial')}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-black text-sm transition-all ${activeTab === 'historial'
                        ? 'bg-background shadow-md text-foreground scale-[1.01]'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                        }`}
                >
                    <Archive className={`w-4 h-4 ${activeTab === 'historial' ? 'text-primary' : ''}`} />
                    Historial y Auditoría
                </button>
            </div>

            {/* Stats Cards (Dynamic based on Tab) */}
            {stats && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                    {tabStats.map((stat, i) => (
                        <Card key={i} className={`border border-border/50 shadow-sm transition-all ${activeTab === 'activas' ? 'bg-card' : 'bg-muted/30'}`}>
                            <CardContent className="p-5 flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">{stat.label}</p>
                                    <p className="text-2xl font-black tracking-tight">{stat.value}</p>
                                </div>
                                <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-inner" style={{ background: `${stat.color}15` }}>
                                    <stat.icon className="w-6 h-6" style={{ color: stat.color }} />
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* View Header / Search */}
            <div className="flex items-center justify-between gap-4 mb-4">
                <h2 className="text-xl font-black text-foreground">
                    {activeTab === 'activas' ? 'Atención en Curso' : 'Órdenes Procesadas'}
                </h2>
                <div className="relative w-full sm:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar por cliente, ID o folio..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="pl-9 h-10 rounded-xl bg-card border-border/50"
                    />
                </div>
            </div>

            {/* Orders List */}
            <div className="space-y-3">
                {isLoading ? (
                    <div className="text-center py-20 bg-card rounded-2xl border border-border/50 shadow-sm mt-4">
                        <div className="w-10 h-10 border-4 border-muted border-t-primary rounded-full animate-spin mx-auto mb-4" />
                        <p className="text-muted-foreground font-bold">Cargando órdenes...</p>
                    </div>
                ) : filteredOrders.length === 0 ? (
                    <div className="text-center py-20 bg-card rounded-2xl border border-border/50 shadow-sm mt-4">
                        <Package className="w-16 h-16 mx-auto mb-4 text-muted-foreground/20" />
                        <p className="text-foreground font-black text-xl mb-1">
                            {searchTerm ? 'No se encontraron resultados' : (activeTab === 'activas' ? 'No hay trabajo pendiente' : 'El historial está vacío')}
                        </p>
                        <p className="text-muted-foreground/80 text-sm font-medium">
                            {searchTerm ? 'Intenta buscar con otros términos.' : (activeTab === 'activas' ? '¡Excelente trabajo! Las nuevas órdenes aparecerán aquí.' : 'Aún no hay órdenes completadas hoy.')}
                        </p>
                    </div>
                ) : (
                    <div className={activeTab === 'activas' ? 'grid grid-cols-1 md:grid-cols-2 gap-4' : 'flex flex-col gap-2'}>
                        {filteredOrders.map(order => {
                            const statusInfo = ORDER_STATUSES[order.status] || ORDER_STATUSES.pending
                            const payment = PAYMENT_LABELS[order.payment_method] || PAYMENT_LABELS.cash
                            const items = Array.isArray(order.items) ? order.items : []
                            const isPending = order.status === 'pending'
                            const isActiveTab = activeTab === 'activas'

                            if (isActiveTab) {
                                // ─── KANBAN STYLE CARDS FOR ACTIVE TAB ───
                                // Ghost Orders: older than 8 hours but still active
                                const isGhostOrder = (Date.now() - new Date(order.created_at).getTime()) > (8 * 60 * 60 * 1000)

                                return (
                                    <div
                                        key={order.id}
                                        onClick={() => setSelectedOrder(order)}
                                        className={`bg-card border rounded-2xl p-5 cursor-pointer transition-all hover:shadow-lg hover:-translate-y-0.5 relative overflow-hidden ${isGhostOrder
                                            ? 'border-red-500/50 shadow-red-500/10'
                                            : isPending ? 'border-amber-400/50 dark:border-amber-500/30 bg-amber-50/50 dark:bg-amber-900/10 shadow-amber-100/50 dark:shadow-none' : 'border-border/60 hover:border-primary/40'
                                            }`}
                                    >
                                        {isGhostOrder && (
                                            <div className="absolute top-0 left-0 w-full bg-red-500 text-white text-[10px] uppercase font-black tracking-widest text-center py-0.5 flex items-center justify-center gap-1.5 shadow-sm">
                                                <AlertTriangle className="w-3 h-3" /> Orden antigua atrapada - Requiere Acción
                                            </div>
                                        )}
                                        <div className={`flex items-start justify-between gap-4 mb-4 ${isGhostOrder ? 'mt-4' : ''}`}>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap mb-1.5">
                                                    <span className="font-black text-lg text-foreground tracking-tight">{order.customer_name || 'Cliente General'}</span>
                                                    <span
                                                        className="text-[10px] uppercase tracking-widest font-black px-2 py-1 rounded-md text-white shrink-0 shadow-sm"
                                                        style={{ background: statusInfo.color }}
                                                    >
                                                        {statusInfo.label}
                                                    </span>
                                                </div>
                                                <div className="flex items-center flex-wrap gap-x-3 gap-y-1.5 text-xs font-semibold text-muted-foreground">
                                                    <span className="bg-muted px-2 py-0.5 rounded-md text-foreground">
                                                        {order.order_type === 'delivery' ? '🛵 Domicilio' :
                                                            order.order_type === 'dine_in' ? '🪑 Mesa' : '🏪 Para Llevar'}
                                                    </span>
                                                    {order.table_number && (
                                                        <span className="text-orange-600 dark:text-orange-400 font-bold bg-orange-100 dark:bg-orange-950/50 px-2 py-0.5 rounded-md">Mesa {order.table_number}</span>
                                                    )}
                                                    <span className="opacity-70">#{order.folio || order.id.slice(0, 5)}</span>
                                                </div>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <div className="flex items-center justify-end gap-1.5 mb-1 text-muted-foreground font-medium text-xs">
                                                    <Clock className="w-3.5 h-3.5" />
                                                    {getTimeAgo(order.created_at)}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Simplified Items Preview */}
                                        <div className="bg-muted/40 rounded-xl p-3 mb-4 space-y-1">
                                            {items.slice(0, 3).map((item, idx) => (
                                                <div key={idx} className="flex justify-between text-sm">
                                                    <span className="font-medium text-foreground truncate pr-4">
                                                        <span className="font-black text-muted-foreground mr-1.5">{item.quantity}x</span>
                                                        {item.product?.name || item.name || 'Producto'}
                                                    </span>
                                                </div>
                                            ))}
                                            {items.length > 3 && (
                                                <p className="text-xs font-bold text-muted-foreground pt-1">+ {items.length - 3} artículos más</p>
                                            )}
                                        </div>

                                        {/* Quick Action Buttons */}
                                        <div className="flex gap-2">
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
                                                        className="flex-1 py-2.5 rounded-xl text-xs font-black text-white hover:brightness-110 active:scale-95 transition-all shadow-sm"
                                                        style={{ background: nextInfo.color }}
                                                    >
                                                        {nextInfo.emoji} {nextInfo.label}
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )
                            }

                            // ─── LIST STYLE ROWS FOR HISTORIAL TAB ───
                            return (
                                <div
                                    key={order.id}
                                    onClick={() => setSelectedOrder(order)}
                                    className="bg-card border border-border/50 rounded-xl p-3 cursor-pointer transition-all hover:bg-muted/30 flex items-center justify-between gap-4 group"
                                >
                                    <div className="flex items-center gap-4 flex-1 min-w-0">
                                        <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 opacity-80" style={{ background: `${statusInfo.color}15`, color: statusInfo.color }}>
                                            {statusInfo.emoji}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-0.5">
                                                <span className="font-bold text-sm text-foreground truncate">{order.customer_name || 'Cliente General'}</span>
                                                <span
                                                    className="text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded"
                                                    style={{ color: statusInfo.color, background: `${statusInfo.color}15` }}
                                                >
                                                    {statusInfo.label}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-3 text-xs text-muted-foreground font-medium">
                                                <span>#{order.folio || order.id.slice(0, 6)}</span>
                                                <span className="w-1 h-1 rounded-full bg-border" />
                                                <span className="flex items-center gap-1">
                                                    {payment.icon} {payment.label}
                                                </span>
                                                <span className="w-1 h-1 rounded-full bg-border" />
                                                <span>{new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right shrink-0 pr-2">
                                        <p className="font-black text-foreground">{formatCurrency(order.total)}</p>
                                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">{items.length} items</p>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}

                {/* Pagination Button for History Tab */}
                {activeTab === 'historial' && filteredOrders.length > 0 && filteredOrders.length < totalHistoryCount && (
                    <div className="pt-4 flex justify-center w-full">
                        <Button
                            variant="outline"
                            onClick={() => setHistoryPageSize(p => p + 50)}
                            className="w-full sm:w-auto font-bold rounded-xl h-11 border-border/60 hover:bg-muted transition-all"
                        >
                            <ChevronDown className="w-4 h-4 mr-2" />
                            Cargar más órdenes pasadas ({totalHistoryCount - filteredOrders.length} restantes)
                        </Button>
                    </div>
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
