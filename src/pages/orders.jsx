import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, Filter, Package, Clock, ChefHat, Truck, CheckCircle2, XCircle, Eye, ChevronDown, MapPin, Phone, User, CreditCard, Banknote, Building2, ExternalLink, Trash2, RefreshCw, Armchair, Store, Edit2, Save, X } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Textarea } from '../components/ui/textarea'
import { Card, CardContent } from '../components/ui/card'
import { useAuth } from '../features/auth/auth-context'
import { getOrders, updateOrderStatus, updateOrder, deleteOrder, getOrderStats, ORDER_STATUSES, PAYMENT_METHODS, getNextStatuses } from '../lib/order-service'
import { toast } from 'sonner'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { OrderDetailModal } from '../features/orders/order-detail-modal'


const STATUS_FILTERS = [
    { value: 'all', label: 'Todos', icon: Package },
    { value: 'active', label: 'Activos', icon: Clock },
    { value: 'delivered', label: 'Entregados', icon: CheckCircle2 },
    { value: 'cancelled', label: 'Cancelados', icon: XCircle },
]

const PAYMENT_LABELS = PAYMENT_METHODS


export function OrdersPage() {
    const { user } = useAuth()
    const queryClient = useQueryClient()
    const [statusFilter, setStatusFilter] = useState('all')
    const [searchTerm, setSearchTerm] = useState('')
    const [selectedOrder, setSelectedOrder] = useState(null)
    const { data: orders = [], isLoading } = useQuery({
        queryKey: ['orders'],
        queryFn: () => getOrders(user.id, { includeClosed: true }),
        enabled: !!user,
    })

    const { data: stats } = useQuery({
        queryKey: ['order-stats'],
        queryFn: () => getOrderStats(user.id, { filterByShift: false }),
        enabled: !!user,
    })

    // Realtime Subscription
    useEffect(() => {
        if (!user?.id) return

        // Notification sound (Standard clean "ping")
        const newOrderSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3')

        console.log('Setting up robust orders subscription for user:', user.id)

        const channel = supabase
            .channel(`orders-${user.id}`) // Unique channel per user
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'orders',
                    filter: `user_id=eq.${user.id}`
                },
                (payload) => {
                    console.log('🔔 Realtime update:', payload.eventType)

                    // Invalidate caches to show new data
                    queryClient.invalidateQueries(['orders'])
                    queryClient.invalidateQueries(['order-stats'])

                    // Play sound only on new orders
                    if (payload.eventType === 'INSERT') {
                        newOrderSound.play().catch(e => {
                            console.warn('Audio play blocked by browser. User interaction required:', e)
                        })
                        toast.success('¡Nuevo pedido recibido!', {
                            icon: '🔔',
                            duration: 5000
                        })
                    }
                }
            )
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    console.log('✅ Realtime orders active')
                }
            })

        return () => {
            supabase.removeChannel(channel)
        }
    }, [user?.id, queryClient])

    const updateStatusMutation = useMutation({
        mutationFn: ({ orderId, status }) => updateOrderStatus(orderId, status, user.id),
        onSuccess: () => {
            queryClient.invalidateQueries(['orders'])
            queryClient.invalidateQueries(['order-stats'])
            toast.success('Estado actualizado')
        },
        onError: (error) => toast.error(error.message || 'Error al actualizar'),
    })

    const updateOrderMutation = useMutation({
        mutationFn: ({ orderId, updates }) => updateOrder(orderId, updates, user.id),
        onSuccess: (data) => {
            queryClient.invalidateQueries(['orders'])
            setSelectedOrder(data) // Update local selected order
            toast.success('Orden actualizada')
        },
        onError: (error) => toast.error(error.message || 'Error al actualizar orden'),
    })

    const deleteMutation = useMutation({
        mutationFn: (orderId) => deleteOrder(orderId, user.id),
        onSuccess: () => {
            queryClient.invalidateQueries(['orders'])
            queryClient.invalidateQueries(['order-stats'])
            setSelectedOrder(null)
            toast.success('Orden eliminada')
        },
        onError: (error) => toast.error(error.message || 'Error al eliminar'),
    })

    const filteredOrders = orders.filter(order => {
        const matchesSearch = !searchTerm ||
            order.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            order.id?.toLowerCase().includes(searchTerm.toLowerCase())

        let matchesFilter = true
        if (statusFilter === 'active') matchesFilter = ['pending', 'confirmed', 'preparing', 'ready', 'on_the_way'].includes(order.status)
        else if (statusFilter === 'delivered') matchesFilter = order.status === 'delivered'
        else if (statusFilter === 'cancelled') matchesFilter = order.status === 'cancelled'

        return matchesSearch && matchesFilter
    })

    const getTimeAgo = (dateStr) => {
        const diff = Date.now() - new Date(dateStr).getTime()
        const mins = Math.floor(diff / 60000)
        if (mins < 1) return 'Ahora'
        if (mins < 60) return `${mins}m`
        const hrs = Math.floor(mins / 60)
        if (hrs < 24) return `${hrs}h`
        const days = Math.floor(hrs / 24)
        return `${days}d`
    }

    return (
        <div className="p-6 max-w-6xl mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Órdenes</h1>
                    <p className="text-muted-foreground text-sm">Gestiona y da seguimiento a los pedidos</p>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { queryClient.invalidateQueries(['orders']); queryClient.invalidateQueries(['order-stats']) }}
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
                        { label: 'Ingresos', value: `$${stats.revenue.toFixed(0)}`, color: '#10B981', icon: CreditCard },
                    ].map((stat, i) => (
                        <Card key={i} className="border border-gray-200">
                            <CardContent className="p-4 flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${stat.color}15` }}>
                                    <stat.icon className="w-5 h-5" style={{ color: stat.color }} />
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                                    <p className="text-lg font-bold">{stat.value}</p>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3 mb-6">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar por nombre o ID..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="pl-9"
                    />
                </div>
                <div className="flex gap-1 bg-muted rounded-lg p-1">
                    {STATUS_FILTERS.map(f => (
                        <button
                            key={f.value}
                            onClick={() => setStatusFilter(f.value)}
                            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${statusFilter === f.value
                                ? 'bg-background shadow-sm text-foreground'
                                : 'text-muted-foreground hover:text-foreground'
                                }`}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Orders List */}
            {isLoading ? (
                <div className="text-center py-16">
                    <div className="w-10 h-10 border-4 border-gray-200 border-t-gray-800 rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-muted-foreground">Cargando órdenes...</p>
                </div>
            ) : filteredOrders.length === 0 ? (
                <div className="text-center py-16">
                    <Package className="w-14 h-14 mx-auto mb-4 text-gray-200" />
                    <p className="text-muted-foreground font-medium">
                        {orders.length === 0 ? 'No hay órdenes todavía' : 'No se encontraron órdenes'}
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filteredOrders.map(order => {
                        const statusInfo = ORDER_STATUSES[order.status] || ORDER_STATUSES.pending
                        const payment = PAYMENT_LABELS[order.payment_method] || PAYMENT_LABELS.cash
                        const items = Array.isArray(order.items) ? order.items : []

                        return (
                            <div
                                key={order.id}
                                onClick={() => setSelectedOrder(order)}
                                className={`bg-card border rounded-xl p-4 cursor-pointer hover:shadow-md transition-all ${order.status === 'pending' ? 'border-amber-200 bg-amber-50/30' : 'border-border'
                                    }`}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-bold text-foreground">{order.customer_name}</span>
                                            <span
                                                className="text-xs font-semibold px-2 py-0.5 rounded-full text-white"
                                                style={{ background: statusInfo.color }}
                                            >
                                                {statusInfo.emoji} {statusInfo.label}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                            <span>
                                                {order.order_type === 'delivery' ? '🛵 Envío' :
                                                    order.order_type === 'dine_in' ? '🪑 Mesa' : '🏪 Recoger'}
                                            </span>
                                            {order.table_number && <span className="font-bold text-orange-600">#{order.table_number}</span>}
                                            <span>{payment.icon} {payment.label}</span>
                                            {order.cash_cut_id ? (
                                                <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded border border-gray-200">
                                                    🔒 Corte
                                                </span>
                                            ) : order.status === 'delivered' ? (
                                                <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded border border-green-200 font-bold animate-pulse">
                                                    💰 Por Cortar
                                                </span>
                                            ) : null}
                                            <span className="font-mono">#{order.id.slice(0, 6)}</span>
                                        </div>
                                        {items.length > 0 && (
                                            <p className="text-xs text-muted-foreground mt-1.5 truncate">
                                                {items.map(i => `${i.quantity}x ${i.product?.name || i.name}`).join(', ')}
                                            </p>
                                        )}
                                    </div>

                                    <div className="text-right shrink-0">
                                        <p className="font-bold text-foreground">${parseFloat(order.total).toFixed(2)}</p>
                                        <p className="text-xs text-muted-foreground">{getTimeAgo(order.created_at)}</p>
                                    </div>
                                </div>

                                {['pending', 'confirmed', 'preparing', 'ready', 'on_the_way'].includes(order.status) && (
                                    <div className="flex gap-2 mt-3 pt-3 border-t border-border">
                                        {getNextStatuses(order.status).map(next => {
                                            const nextInfo = ORDER_STATUSES[next]
                                            return (
                                                <button
                                                    key={next}
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        updateStatusMutation.mutate({ orderId: order.id, status: next })
                                                    }}
                                                    className="flex-1 py-2 rounded-lg text-xs font-semibold text-white transition-all hover:opacity-90 active:scale-95"
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
                                            className="px-3 py-2 rounded-lg text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 transition-all active:scale-95"
                                        >
                                            ❌
                                        </button>
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}

            {selectedOrder && (
                <OrderDetailModal
                    order={selectedOrder}
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

