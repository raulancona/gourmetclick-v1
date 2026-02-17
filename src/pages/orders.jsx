import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, Filter, Package, Clock, ChefHat, Truck, CheckCircle2, XCircle, Eye, ChevronDown, MapPin, Phone, User, CreditCard, Banknote, Building2, ExternalLink, Trash2, RefreshCw, Armchair, Store, Edit2, Save, X } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Textarea } from '../components/ui/textarea'
import { Card, CardContent } from '../components/ui/card'
import { useAuth } from '../features/auth/auth-context'
import { getOrders, updateOrderStatus, updateOrder, deleteOrder, getOrderStats, ORDER_STATUSES } from '../lib/order-service'
import { toast } from 'sonner'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'

const STATUS_FILTERS = [
    { value: 'all', label: 'Todos', icon: Package },
    { value: 'active', label: 'Activos', icon: Clock },
    { value: 'delivered', label: 'Entregados', icon: CheckCircle2 },
    { value: 'cancelled', label: 'Cancelados', icon: XCircle },
]

const PAYMENT_LABELS = {
    cash: { label: 'Efectivo', icon: '💵' },
    transfer: { label: 'Transferencia', icon: '🏦' },
    card: { label: 'Tarjeta', icon: '💳' },
}

export function OrdersPage() {
    const { user } = useAuth()
    const queryClient = useQueryClient()
    const [statusFilter, setStatusFilter] = useState('all')
    const [searchTerm, setSearchTerm] = useState('')
    const [selectedOrder, setSelectedOrder] = useState(null)

    const { data: orders = [], isLoading } = useQuery({
        queryKey: ['orders'],
        queryFn: () => getOrders(user.id),
        enabled: !!user,
        refetchInterval: 30000,
    })

    const { data: stats } = useQuery({
        queryKey: ['order-stats'],
        queryFn: () => getOrderStats(user.id),
        enabled: !!user,
    })

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

function getNextStatuses(current) {
    const flow = {
        pending: ['confirmed'],
        confirmed: ['preparing'],
        preparing: ['ready'],
        ready: ['on_the_way', 'delivered'],
        on_the_way: ['delivered'],
    }
    return flow[current] || []
}

function OrderDetailModal({ order, onClose, onUpdateStatus, onUpdateOrder, onDelete }) {
    const navigate = useNavigate()
    const [isEditing, setIsEditing] = useState(false)
    const [formData, setFormData] = useState({
        customer_name: order.customer_name || '',
        customer_phone: order.customer_phone || '',
        order_type: order.order_type || 'dine_in',
        table_number: order.table_number || '',
        delivery_address: order.delivery_address || '',
        notes: order.notes || ''
    })

    const statusInfo = ORDER_STATUSES[order.status] || ORDER_STATUSES.pending
    const items = Array.isArray(order.items) ? order.items : []
    const payment = PAYMENT_LABELS[order.payment_method] || PAYMENT_LABELS.cash
    const statusFlow = ['pending', 'confirmed', 'preparing', 'ready', 'on_the_way', 'delivered']
    const currentIdx = statusFlow.indexOf(order.status)

    const handleSave = () => {
        onUpdateOrder(formData)
        setIsEditing(false)
    }

    const handleEditInPOS = () => {
        // Save order to localStorage to be picked up by POS
        localStorage.setItem('edit_order', JSON.stringify(order))
        navigate('/pos')
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm"></div>
            <div className="relative bg-card w-full max-w-lg rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto flex flex-col" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="sticky top-0 bg-card border-b border-border px-5 py-4 flex items-center justify-between rounded-t-2xl z-10">
                    <div>
                        <h2 className="font-bold text-lg">Orden #{order.id.slice(0, 8)}</h2>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{new Date(order.created_at).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                            {/* Edit in POS Link - Only for active orders */}
                            {!['delivered', 'cancelled'].includes(order.status) && (
                                <button
                                    onClick={handleEditInPOS}
                                    className="text-primary hover:underline flex items-center gap-1 ml-2 font-medium"
                                >
                                    <Edit2 className="w-3 h-3" />
                                    Editar productos
                                </button>
                            )}
                        </div>
                    </div>
                    <div className="flex gap-2">
                        {!isEditing && order.status !== 'cancelled' && order.status !== 'delivered' && (
                            <Button variant="ghost" size="icon" onClick={() => setIsEditing(true)} title="Editar detalles">
                                <Edit2 className="w-4 h-4" />
                            </Button>
                        )}
                        <button onClick={onClose} className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center hover:bg-accent transition-colors">
                            <X className="w-5 h-5 text-muted-foreground" />
                        </button>
                    </div>
                </div>

                <div className="p-5 space-y-5 flex-1 overflow-y-auto">
                    {isEditing ? (
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label>Nombre del Cliente</Label>
                                <Input value={formData.customer_name} onChange={e => setFormData({ ...formData, customer_name: e.target.value })} />
                            </div>
                            <div className="space-y-2">
                                <Label>Teléfono</Label>
                                <Input value={formData.customer_phone} onChange={e => setFormData({ ...formData, customer_phone: e.target.value })} />
                            </div>
                            <div className="space-y-2">
                                <Label>Tipo de Orden</Label>
                                <Select value={formData.order_type} onValueChange={v => setFormData({ ...formData, order_type: v })}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="dine_in">Comer aquí (Mesa)</SelectItem>
                                        <SelectItem value="pickup">Pasar a recoger</SelectItem>
                                        <SelectItem value="delivery">Envío a domicilio</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            {formData.order_type === 'dine_in' && (
                                <div className="space-y-2">
                                    <Label>Número de Mesa</Label>
                                    <Input value={formData.table_number} onChange={e => setFormData({ ...formData, table_number: e.target.value })} />
                                </div>
                            )}
                            {formData.order_type === 'delivery' && (
                                <div className="space-y-2">
                                    <Label>Dirección</Label>
                                    <Input value={formData.delivery_address} onChange={e => setFormData({ ...formData, delivery_address: e.target.value })} />
                                </div>
                            )}
                            <div className="space-y-2">
                                <Label>Notas</Label>
                                <Textarea value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} />
                            </div>
                            <div className="flex gap-2 pt-2">
                                <Button className="flex-1" onClick={handleSave}>
                                    <Save className="w-4 h-4 mr-2" /> Guardar Cambios
                                </Button>
                                <Button variant="outline" onClick={() => setIsEditing(false)}>
                                    Cancelar
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Status Timeline */}
                            <div>
                                <h3 className="text-sm font-semibold text-foreground mb-3">Estado del pedido</h3>
                                <div className="flex items-center gap-1">
                                    {statusFlow.map((s, i) => {
                                        const info = ORDER_STATUSES[s]
                                        const isActive = i <= currentIdx && order.status !== 'cancelled'
                                        const isCurrent = s === order.status
                                        return (
                                            <div key={s} className="flex-1 flex flex-col items-center gap-1">
                                                <div
                                                    className={`w-full h-2 rounded-full transition-all ${i === 0 ? 'rounded-l-full' : ''} ${i === statusFlow.length - 1 ? 'rounded-r-full' : ''}`}
                                                    style={{ background: isActive ? info.color : '#e5e7eb' }}
                                                />
                                                {isCurrent && (
                                                    <span className="text-[10px] font-bold" style={{ color: info.color }}>
                                                        {info.emoji} {info.label}
                                                    </span>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                                {order.status === 'cancelled' && (
                                    <p className="text-center text-sm font-bold text-red-500 mt-2">❌ Cancelado</p>
                                )}
                            </div>

                            {/* Customer Info */}
                            <div className="bg-muted rounded-xl p-4 space-y-2">
                                <div className="flex items-center gap-2 text-sm">
                                    <User className="w-4 h-4 text-muted-foreground" />
                                    <span className="font-medium">{order.customer_name}</span>
                                </div>
                                {order.customer_phone && (
                                    <div className="flex items-center gap-2 text-sm">
                                        <Phone className="w-4 h-4 text-muted-foreground" />
                                        <span>{order.customer_phone}</span>
                                    </div>
                                )}
                                <div className="flex items-center gap-2 text-sm">
                                    {order.order_type === 'delivery' ? (
                                        <><Truck className="w-4 h-4 text-muted-foreground" /> <span>🛵 Envío a domicilio</span></>
                                    ) : order.order_type === 'dine_in' ? (
                                        <><Armchair className="w-4 h-4 text-muted-foreground" /> <span className="font-bold">🪑 Comer en el lugar (Mesa {order.table_number})</span></>
                                    ) : (
                                        <><Store className="w-4 h-4 text-muted-foreground" /> <span>🏪 Paso a recoger</span></>
                                    )}
                                </div>
                                {order.delivery_address && (
                                    <div className="flex items-center gap-2 text-sm">
                                        <MapPin className="w-4 h-4 text-muted-foreground" />
                                        <span>{order.delivery_address}</span>
                                    </div>
                                )}
                                {order.location_url && (
                                    <a href={order.location_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-blue-600 hover:underline">
                                        <ExternalLink className="w-4 h-4" />
                                        Ver ubicación en Google Maps
                                    </a>
                                )}
                                <div className="flex items-center gap-2 text-sm">
                                    <CreditCard className="w-4 h-4 text-muted-foreground" />
                                    <span>{payment.icon} {payment.label}</span>
                                </div>
                            </div>

                            {/* Items */}
                            <div>
                                <h3 className="text-sm font-semibold text-foreground mb-2">Productos</h3>
                                <div className="bg-muted rounded-xl divide-y divide-border overflow-hidden">
                                    {items.map((item, i) => (
                                        <div key={i} className="p-3 flex justify-between items-start">
                                            <div>
                                                <span className="font-medium text-sm">{item.quantity}x {item.product?.name || item.name}</span>
                                                {item.modifiers?.length > 0 && (
                                                    <div className="flex flex-wrap gap-1 mt-1">
                                                        {item.modifiers.map((m, j) => (
                                                            <span key={j} className="text-[11px] px-1.5 py-0.5 bg-background rounded text-muted-foreground">
                                                                {m.name}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                            <span className="font-bold text-sm">${parseFloat(item.subtotal || 0).toFixed(2)}</span>
                                        </div>
                                    ))}
                                    <div className="p-3 flex justify-between bg-background">
                                        <span className="font-bold">Total</span>
                                        <span className="font-bold text-lg">${parseFloat(order.total).toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Notes */}
                            {order.notes && (
                                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                                    <p className="text-sm text-amber-900"><strong>📝 Notas:</strong> {order.notes}</p>
                                </div>
                            )}

                            {/* Status Actions */}
                            {order.status !== 'delivered' && order.status !== 'cancelled' && (
                                <div>
                                    <h3 className="text-sm font-semibold text-foreground mb-2">Cambiar estado</h3>
                                    <div className="grid grid-cols-2 gap-2">
                                        {Object.entries(ORDER_STATUSES).map(([key, info]) => {
                                            if (key === order.status) return null
                                            return (
                                                <button
                                                    key={key}
                                                    onClick={() => onUpdateStatus(key)}
                                                    className={`p-3 rounded-xl border-2 text-left text-sm font-medium transition-all hover:shadow-sm ${key === 'cancelled'
                                                        ? 'border-red-200 hover:border-red-400 text-red-700 bg-red-50'
                                                        : 'border-gray-200 hover:border-gray-300'
                                                        }`}
                                                >
                                                    {info.emoji} {info.label}
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    {/* Delete */}
                    {!isEditing && (
                        <div className="pt-2 border-t border-border">
                            <button
                                onClick={onDelete}
                                className="w-full py-3 rounded-xl text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 transition-colors flex items-center justify-center gap-2"
                            >
                                <Trash2 className="w-4 h-4" />
                                Eliminar orden
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
