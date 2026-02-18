import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    X, Edit2, Save, User, Phone, MapPin, Truck, Armchair, Store,
    CreditCard, ExternalLink, Trash2
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

export function OrderDetailModal({ order, onClose, onUpdateStatus, onUpdateOrder, onDelete }) {
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
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{new Date(order.created_at).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })}</span>
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
                    <div className="flex gap-2 text-foreground">
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
                                    {items.map((item, i) => (
                                        <div key={i} className="p-3 flex justify-between items-start bg-card/50">
                                            <div>
                                                <span className="font-bold text-sm text-foreground">{item.quantity}x {item.product?.name || item.name}</span>
                                                {item.modifiers?.length > 0 && (
                                                    <div className="flex flex-wrap gap-1 mt-1">
                                                        {item.modifiers.map((m, j) => (
                                                            <span key={j} className="text-[10px] px-1.5 py-0.5 bg-muted rounded text-muted-foreground font-medium border border-border/50">
                                                                {m.name}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                            <span className="font-black text-sm text-foreground"> ${parseFloat(item.price * item.quantity).toFixed(2)}</span>
                                        </div>
                                    ))}
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

                            {/* Status Actions */}
                            {order.status !== 'delivered' && order.status !== 'cancelled' && (
                                <div>
                                    <h3 className="text-sm font-bold text-foreground mb-3">Cambiar estado</h3>
                                    <div className="grid grid-cols-2 gap-2">
                                        {Object.entries(ORDER_STATUSES).map(([key, info]) => {
                                            if (key === order.status) return null
                                            return (
                                                <button
                                                    key={key}
                                                    onClick={() => onUpdateStatus(key)}
                                                    className={`p-3 rounded-xl border border-border text-left transition-all hover:border-primary/50 hover:bg-primary/5 group ${key === 'cancelled'
                                                        ? 'hover:border-red-500/50 hover:bg-red-500/5'
                                                        : ''
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
                        </>
                    )}

                    {/* Delete */}
                    {!isEditing && (
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
                                Eliminar orden
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
