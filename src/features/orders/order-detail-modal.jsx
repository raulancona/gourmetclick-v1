import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    X, Edit2, Save, User, Phone, MapPin, Truck, Armchair, Store,
    CreditCard, ExternalLink, Trash2, Clock, CheckCircle2, Lock
} from 'lucide-react'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Textarea } from '../../components/ui/textarea'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '../../components/ui/select'
import { ORDER_STATUSES, PAYMENT_METHODS, getNextStatuses } from '../../lib/order-service'
import { toast } from 'sonner'

export function OrderDetailModal({ order, onClose, onUpdateStatus, onUpdateOrder, onDelete, isAdmin = false }) {
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
    const payment = PAYMENT_METHODS[order.payment_method] || PAYMENT_METHODS.cash
    const statusFlow = ['pending', 'confirmed', 'preparing', 'ready', 'on_the_way', 'delivered']
    const currentIdx = statusFlow.indexOf(order.status)

    const handleSave = () => {
        onUpdateOrder(formData)
        setIsEditing(false)
    }

    const handleEditInPOS = () => {
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
                        <h2 className="font-bold text-lg text-foreground">Orden #{order.id.slice(0, 8)}</h2>
                        <div className="flex flex-col gap-1 text-xs text-muted-foreground mt-1">
                            <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                Creada: {new Date(order.fecha_creacion || order.created_at).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })}
                            </span>
                            {order.cash_cut_id ? (
                                <span className="flex items-center gap-1.5 text-stone-600 dark:text-stone-400 font-bold bg-stone-50 dark:bg-stone-900/30 px-2 py-1 rounded-lg border border-stone-200 dark:border-stone-700 w-fit mt-1 text-xs">
                                    <Lock className="w-3 h-3" />
                                    Incluida en Corte <span className="font-mono">#{order.cash_cut_id.slice(0, 8)}</span>
                                </span>
                            ) : (['delivered', 'completed'].includes(order.status)) ? (
                                <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-bold bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-lg border border-amber-200/50 w-fit mt-1 text-xs">
                                    <Lock className="w-3 h-3" />
                                    ⏳ Pendiente de Corte
                                </span>
                            ) : null}

                            {order.fecha_cierre && (
                                <span className="flex items-center gap-1 text-green-600 dark:text-green-400 font-medium">
                                    <CheckCircle2 className="w-3 h-3" />
                                    Cerrada: {new Date(order.fecha_cierre).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })}
                                </span>
                            )}
                            {/* Only allow POS-edit for active (not completed/cancelled/delivered) orders.
                                Completed = closed by cashier. Admins can always edit. */}
                            {!['delivered', 'cancelled', 'completed'].includes(order.status) && (
                                <button
                                    onClick={handleEditInPOS}
                                    className="text-primary hover:underline flex items-center gap-1 mt-1 font-medium"
                                >
                                    <Edit2 className="w-3 h-3" />
                                    Editar productos
                                </button>
                            )}
                            {order.status === 'completed' && isAdmin && (
                                <button
                                    onClick={handleEditInPOS}
                                    className="text-amber-500 hover:underline flex items-center gap-1 mt-1 font-medium text-[11px]"
                                >
                                    <Edit2 className="w-3 h-3" />
                                    Editar (Admin)
                                </button>
                            )}
                        </div>
                    </div>
                    <div className="flex gap-2 text-foreground">
                        {/* Edit button: hide for completed (closed) orders for non-admins */}
                        {!isEditing &&
                            order.status !== 'cancelled' &&
                            order.status !== 'delivered' &&
                            order.status !== 'completed' && (
                                <Button variant="ghost" size="icon" onClick={() => setIsEditing(true)} title="Editar detalles">
                                    <Edit2 className="w-4 h-4" />
                                </Button>
                            )}
                        {!isEditing && order.status === 'completed' && isAdmin && (
                            <Button variant="ghost" size="icon" onClick={() => setIsEditing(true)} title="Editar (Admin)" className="text-amber-500">
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
                                <Label className="text-foreground">Nombre del Cliente</Label>
                                <Input value={formData.customer_name} onChange={e => setFormData({ ...formData, customer_name: e.target.value })} />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-foreground">Teléfono</Label>
                                <Input value={formData.customer_phone} onChange={e => setFormData({ ...formData, customer_phone: e.target.value })} />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-foreground">Tipo de Orden</Label>
                                <Select value={formData.order_type} onValueChange={v => setFormData({ ...formData, order_type: v })}>
                                    <SelectTrigger className="text-foreground">
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
                                    <Label className="text-foreground">Número de Mesa</Label>
                                    <Input value={formData.table_number} onChange={e => setFormData({ ...formData, table_number: e.target.value })} />
                                </div>
                            )}
                            {formData.order_type === 'delivery' && (
                                <div className="space-y-2">
                                    <Label className="text-foreground">Dirección</Label>
                                    <Input value={formData.delivery_address} onChange={e => setFormData({ ...formData, delivery_address: e.target.value })} />
                                </div>
                            )}
                            <div className="space-y-2">
                                <Label className="text-foreground">Notas</Label>
                                <Textarea value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} className="text-foreground" />
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
                                <h3 className="text-sm font-semibold text-foreground mb-3 font-bold">Estado del pedido</h3>
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
                            <div className="bg-muted/50 rounded-xl p-4 space-y-2 border border-border">
                                <div className="flex items-center gap-2 text-sm text-foreground">
                                    <User className="w-4 h-4 text-muted-foreground" />
                                    <span className="font-bold">{order.customer_name}</span>
                                </div>
                                {order.customer_phone && (
                                    <div className="flex items-center gap-2 text-sm text-foreground">
                                        <Phone className="w-4 h-4 text-muted-foreground" />
                                        <span>{order.customer_phone}</span>
                                    </div>
                                )}
                                <div className="flex items-center gap-2 text-sm text-foreground">
                                    {order.order_type === 'delivery' ? (
                                        <><Truck className="w-4 h-4 text-muted-foreground" /> <span className="font-semibold">🛵 Envío a domicilio</span></>
                                    ) : order.order_type === 'dine_in' ? (
                                        <><Armchair className="w-4 h-4 text-muted-foreground" /> <span className="font-bold">🪑 Comer en el lugar (Mesa {order.table_number})</span></>
                                    ) : (
                                        <><Store className="w-4 h-4 text-muted-foreground" /> <span className="font-semibold">🏪 Paso a recoger</span></>
                                    )}
                                </div>
                                {order.delivery_address && (
                                    <div className="flex items-center gap-2 text-sm text-foreground">
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
                                <div className="flex items-center gap-2 text-sm text-foreground">
                                    <CreditCard className="w-4 h-4 text-muted-foreground" />
                                    <span className="font-semibold">{payment.icon} {payment.label}</span>
                                </div>
                                <div className="pt-2 mt-2 border-t border-border">
                                    <p className="text-[10px] text-muted-foreground uppercase font-bold mb-1">Link de rastreo</p>
                                    <div className="flex items-center gap-2 bg-background p-2 rounded-lg border border-border">
                                        <input
                                            readOnly
                                            value={`${window.location.origin}/rastreo/${order.tracking_id}`}
                                            className="flex-1 text-xs bg-transparent border-none focus:ring-0 p-0 text-muted-foreground font-mono"
                                        />
                                        <button
                                            onClick={() => {
                                                navigator.clipboard.writeText(`${window.location.origin}/rastreo/${order.tracking_id}`)
                                                toast.success('Link copiado')
                                            }}
                                            className="text-primary hover:text-primary/80"
                                            title="Copiar link"
                                        >
                                            <ExternalLink className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Items */}
                            <div>
                                <h3 className="text-sm font-bold text-foreground mb-2">Productos</h3>
                                <div className="bg-muted/30 rounded-xl divide-y divide-border overflow-hidden border border-border">
                                    {items.map((item, i) => {
                                        // Detect any form of extras/modifiers
                                        const extras = item.modifiers || item.extras || item.variantes || item.modificadores || []

                                        return (
                                            <div key={i} className="bg-card/50">
                                                <div className="p-3 flex justify-between items-start">
                                                    <div>
                                                        <span className="font-bold text-sm text-foreground">{item.quantity}x {item.product?.name || item.name}</span>
                                                    </div>
                                                    <span className="font-black text-sm text-foreground">
                                                        ${parseFloat((item.unit_price || item.price) * item.quantity).toFixed(2)}
                                                    </span>
                                                </div>

                                                {/* Extras and special instructions */}
                                                {extras.length > 0 && (
                                                    <div className="px-3 pb-3 ml-4 space-y-1 border-l-2 border-primary/10">
                                                        {extras.map((ext, j) => {
                                                            // Items saved as {name:'Nota', value:'...'} are special instructions
                                                            const isNote = !ext.price && !ext.extra_price && ext.value
                                                            return (
                                                                <div key={j} className={`flex justify-between items-start text-[11px] font-medium ${isNote ? 'text-amber-600 dark:text-amber-400 bg-amber-500/10 rounded-lg px-2 py-1' : 'text-muted-foreground'}`}>
                                                                    <div className="flex items-center gap-1.5">
                                                                        {isNote ? (
                                                                            <span>📝 <strong>Instrucciones:</strong> {ext.value || ext.name}</span>
                                                                        ) : (
                                                                            <>
                                                                                <span className="w-1.5 h-1.5 rounded-full bg-primary/20 shrink-0" />
                                                                                <span>{ext.name || ext.nombre}</span>
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                    {!isNote && (ext.price > 0 || ext.extra_price > 0) && (
                                                                        <span>+${parseFloat((ext.price || ext.extra_price || 0) * item.quantity).toFixed(2)}</span>
                                                                    )}
                                                                </div>
                                                            )
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}
                                    <div className="p-4 flex justify-between bg-muted/50 items-center">
                                        <span className="font-bold text-foreground">Total</span>
                                        <span className="font-black text-xl text-primary">${parseFloat(order.total).toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Notes */}
                            {order.notes && (
                                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
                                    <p className="text-sm text-amber-600 dark:text-amber-400"><strong>📝 Notas:</strong> {order.notes}</p>
                                </div>
                            )}

                            {/* Status Actions: hide for completed/cancelled/delivered (closed orders) unless admin */}
                            {order.status !== 'delivered' &&
                                order.status !== 'cancelled' &&
                                order.status !== 'completed' && (
                                    <div>
                                        <h3 className="text-sm font-bold text-foreground mb-3">Cambiar estado</h3>
                                        <div className="grid grid-cols-2 gap-2">
                                            {Object.entries(ORDER_STATUSES).map(([key, info]) => {
                                                if (key === order.status) return null
                                                if (info.hidden && !isAdmin) return null // Hide restricted options like "completed" from cashiers

                                                return (
                                                    <button
                                                        key={key}
                                                        onClick={() => onUpdateStatus(key)}
                                                        className={`p-3 rounded-xl border border-border text-left transition-all hover:border-primary/50 hover:bg-primary/5 group ${key === 'cancelled' ? 'hover:border-red-500/50 hover:bg-red-500/5' : ''
                                                            }`}
                                                    >
                                                        <div className="text-lg mb-1">{info.emoji}</div>
                                                        <div className={`text-xs font-bold leading-tight ${key === 'cancelled' ? 'group-hover:text-red-500' : 'group-hover:text-primary'} text-foreground`}>
                                                            {info.label}
                                                        </div>
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )}
                            {/* Closed badge for completed orders */}
                            {order.status === 'completed' && (
                                <div className="bg-muted/50 border border-border rounded-xl p-4 text-center mt-4">
                                    <p className="text-sm font-bold text-muted-foreground">✅ Orden Cerrada</p>
                                    <p className="text-xs text-muted-foreground mt-1 mb-3">
                                        {isAdmin ? 'Como admin puedes editar los datos o reabrirla.' : 'Esta orden fue liquidada en el cierre de turno.'}
                                    </p>
                                    {isAdmin && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => {
                                                if (confirm('¿Estás seguro de reabrir esta orden? Se moverá a estado "Entregado" y volverá a contabilizarse en ventas activas.')) {
                                                    onUpdateStatus('delivered')
                                                }
                                            }}
                                            className="w-full border-amber-500/30 text-amber-600 hover:bg-amber-500/10"
                                        >
                                            <CheckCircle2 className="w-4 h-4 mr-2" />
                                            Reabrir Orden (Deshacer Cierre)
                                        </Button>
                                    )}
                                </div>
                            )}
                        </>
                    )}

                    {/* Delete: only for non-closed orders, or admin for any */}
                    {!isEditing && (order.status !== 'completed' || isAdmin) && (
                        <div className="pt-4 border-t border-border">
                            <button
                                onClick={() => {
                                    if (confirm('¿Estás seguro de eliminar esta orden?')) {
                                        onDelete()
                                    }
                                }}
                                className="w-full py-3 rounded-xl text-sm font-bold text-red-500 bg-red-500/10 hover:bg-red-500/20 transition-colors flex items-center justify-center gap-2"
                            >
                                <Trash2 className="w-4 h-4" />
                                {order.status === 'completed' && isAdmin ? 'Eliminar (Admin)' : 'Eliminar orden'}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
