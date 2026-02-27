import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    X, Edit2, Save, User, Phone, MapPin, Truck, Armchair, Store,
    CreditCard, ExternalLink, Trash2, Clock, CheckCircle2, Lock, History, FileText, ArrowRight, RotateCcw
} from 'lucide-react'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Textarea } from '../../components/ui/textarea'
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '../../components/ui/select'
import { ORDER_STATUSES, PAYMENT_METHODS, getNextStatuses } from '../../lib/order-service'
import { toast } from 'sonner'

// Status flow for the timeline stepper
const STATUS_FLOW = ['pending', 'confirmed', 'preparing', 'ready', 'on_the_way', 'delivered']

export function OrderDetailModal({ order, onClose, onUpdateStatus, onUpdateOrder, onDelete, onReopenOrder, isAdmin = false }) {
    const navigate = useNavigate()
    const [isEditing, setIsEditing] = useState(false)
    const [activeModalTab, setActiveModalTab] = useState('detalles')
    const [isUpdating, setIsUpdating] = useState(false)
    const auditLog = Array.isArray(order.audit_log) ? order.audit_log : []

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
    const currentIdx = STATUS_FLOW.indexOf(order.status)

    // Determine lifecycle context
    const isClosed = !!order.cash_cut_id         // Formally in a cash cut → Historial
    const isPendingCut = !isClosed && (order.status === 'delivered' || order.status === 'cancelled')  // Por Liquidar
    const isActive = !isClosed && !isPendingCut  // Operación Activa

    const nextStatuses = getNextStatuses(order.status)

    const handleStatusChange = async (status) => {
        setIsUpdating(true)
        try {
            await onUpdateStatus(status)
        } finally {
            setIsUpdating(false)
        }
    }

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
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
            <div className="relative bg-card w-full max-w-lg rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto flex flex-col" onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div className="sticky top-0 bg-card border-b border-border px-5 py-4 flex items-center justify-between rounded-t-2xl z-10">
                    <div>
                        <h2 className="font-bold text-lg text-foreground">
                            Orden #{order.folio || order.id.slice(0, 8)}
                        </h2>
                        <div className="flex flex-col gap-1 text-xs text-muted-foreground mt-1">
                            <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {new Date(order.fecha_creacion || order.created_at).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })}
                            </span>

                            {/* Lifecycle Badge */}
                            {isClosed ? (
                                <span className="flex items-center gap-1.5 text-stone-600 dark:text-stone-400 font-bold bg-stone-50 dark:bg-stone-900/30 px-2 py-1 rounded-lg border border-stone-200 dark:border-stone-700 w-fit mt-1">
                                    <Lock className="w-3 h-3" /> Incluida en Corte <span className="font-mono">#{order.cash_cut_id.slice(0, 8)}</span>
                                </span>
                            ) : isPendingCut && order.status === 'delivered' ? (
                                <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-bold bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-lg border border-amber-200/50 w-fit mt-1">
                                    <CheckCircle2 className="w-3 h-3" /> Entregada · Pendiente de Corte de Caja
                                </span>
                            ) : isPendingCut && order.status === 'cancelled' ? (
                                <span className="flex items-center gap-1 text-red-600 dark:text-red-400 font-bold bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded-lg border border-red-200/50 w-fit mt-1">
                                    <X className="w-3 h-3" /> Cancelada · Pendiente de Corte de Caja
                                </span>
                            ) : null}

                            {order.fecha_cierre && (
                                <span className="flex items-center gap-1 text-green-600 dark:text-green-400 font-medium mt-1">
                                    <CheckCircle2 className="w-3 h-3" />
                                    {order.status === 'cancelled' ? 'Cancelada:' : 'Completada:'} {new Date(order.fecha_cierre).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })}
                                </span>
                            )}

                            {isActive && !order.fecha_cierre && (
                                <button onClick={handleEditInPOS} className="text-primary hover:underline flex items-center gap-1 mt-1 font-medium">
                                    <Edit2 className="w-3 h-3" /> Editar productos
                                </button>
                            )}
                            {isClosed && isAdmin && (
                                <button onClick={handleEditInPOS} className="text-amber-500 hover:underline flex items-center gap-1 mt-1 font-medium text-[11px]">
                                    <Edit2 className="w-3 h-3" /> Editar (Admin)
                                </button>
                            )}
                        </div>
                    </div>
                    <div className="flex gap-2">
                        {!isEditing && isActive && order.status !== 'delivered' && order.status !== 'cancelled' && (
                            <Button variant="ghost" size="icon" onClick={() => setIsEditing(true)} title="Editar detalles">
                                <Edit2 className="w-4 h-4" />
                            </Button>
                        )}
                        {!isEditing && isClosed && isAdmin && (
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
                                    <SelectTrigger><SelectValue /></SelectTrigger>
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
                                <Button className="flex-1" onClick={handleSave}><Save className="w-4 h-4 mr-2" /> Guardar</Button>
                                <Button variant="outline" onClick={() => setIsEditing(false)}>Cancelar</Button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-5">
                            {/* Tabs */}
                            <div className="flex gap-1 p-1 bg-muted/60 rounded-xl border border-border/50">
                                <button
                                    onClick={() => setActiveModalTab('detalles')}
                                    className={`flex-1 flex justify-center items-center gap-1.5 py-2.5 text-xs font-bold rounded-lg transition-all ${activeModalTab === 'detalles' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                                >
                                    <FileText className="w-3.5 h-3.5" /> Detalles
                                </button>
                                <button
                                    onClick={() => setActiveModalTab('bitacora')}
                                    className={`flex-1 flex justify-center items-center gap-1.5 py-2.5 text-xs font-bold rounded-lg transition-all ${activeModalTab === 'bitacora' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                                >
                                    <History className="w-3.5 h-3.5" /> Bitácora
                                    {auditLog.length > 0 && <span className="bg-primary/20 text-primary px-1.5 py-0.5 rounded-md text-[10px] ml-1">{auditLog.length}</span>}
                                </button>
                            </div>

                            {activeModalTab === 'detalles' ? (
                                <>
                                    {/* ── Status Stepper (visual only) ── */}
                                    {order.status !== 'cancelled' && (
                                        <div>
                                            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Progreso del pedido</h3>
                                            <div className="flex items-center gap-1">
                                                {STATUS_FLOW.map((s, i) => {
                                                    const info = ORDER_STATUSES[s]
                                                    const isDone = i <= currentIdx
                                                    const isCurrent = s === order.status
                                                    return (
                                                        <div key={s} className="flex-1 flex flex-col items-center gap-1">
                                                            <div
                                                                className={`w-full h-2 rounded-full transition-all`}
                                                                style={{ background: isDone ? info.color : '#e5e7eb' }}
                                                            />
                                                            {isCurrent && (
                                                                <span className="text-[10px] font-bold whitespace-nowrap" style={{ color: info.color }}>
                                                                    {info.emoji} {info.label}
                                                                </span>
                                                            )}
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    )}
                                    {order.status === 'cancelled' && (
                                        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-center">
                                            <p className="font-bold text-red-500">❌ Orden Cancelada</p>
                                        </div>
                                    )}

                                    {/* Customer Info */}
                                    <div className="bg-muted/50 rounded-xl p-4 space-y-2 border border-border">
                                        <div className="flex items-center gap-2 text-sm">
                                            <User className="w-4 h-4 text-muted-foreground shrink-0" />
                                            <span className="font-bold text-foreground">{order.customer_name || 'Cliente General'}</span>
                                        </div>
                                        {order.customer_phone && (
                                            <div className="flex items-center gap-2 text-sm">
                                                <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
                                                <span className="text-foreground">{order.customer_phone}</span>
                                            </div>
                                        )}
                                        <div className="flex items-center gap-2 text-sm">
                                            {order.order_type === 'delivery' ? (
                                                <><Truck className="w-4 h-4 text-muted-foreground shrink-0" /><span className="font-semibold text-foreground">🛵 Envío a domicilio</span></>
                                            ) : order.order_type === 'dine_in' ? (
                                                <><Armchair className="w-4 h-4 text-muted-foreground shrink-0" /><span className="font-bold text-foreground">🪑 Mesa {order.table_number}</span></>
                                            ) : (
                                                <><Store className="w-4 h-4 text-muted-foreground shrink-0" /><span className="font-semibold text-foreground">🏪 Pasa a recoger</span></>
                                            )}
                                        </div>
                                        {order.delivery_address && (
                                            <div className="flex items-center gap-2 text-sm">
                                                <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
                                                <span className="text-foreground">{order.delivery_address}</span>
                                            </div>
                                        )}
                                        {order.location_url && (
                                            <a href={order.location_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-blue-600 hover:underline">
                                                <ExternalLink className="w-4 h-4 shrink-0" /> Ver en Google Maps
                                            </a>
                                        )}
                                        <div className="flex items-center gap-2 text-sm">
                                            <CreditCard className="w-4 h-4 text-muted-foreground shrink-0" />
                                            <span className="font-semibold text-foreground">{payment.icon} {payment.label}</span>
                                        </div>
                                        {order.tracking_id && (
                                            <div className="pt-2 mt-1 border-t border-border">
                                                <p className="text-[10px] text-muted-foreground uppercase font-bold mb-1">Link de rastreo</p>
                                                <div className="flex items-center gap-2 bg-background p-2 rounded-lg border border-border">
                                                    <input
                                                        readOnly
                                                        value={`${window.location.origin}/rastreo/${order.tracking_id}`}
                                                        className="flex-1 text-xs bg-transparent border-none focus:ring-0 p-0 text-muted-foreground font-mono"
                                                    />
                                                    <button
                                                        onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/rastreo/${order.tracking_id}`); toast.success('Link copiado') }}
                                                        className="text-primary hover:text-primary/80"
                                                    >
                                                        <ExternalLink className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Items */}
                                    <div>
                                        <h3 className="text-sm font-bold text-foreground mb-2">Productos</h3>
                                        <div className="bg-muted/30 rounded-xl divide-y divide-border overflow-hidden border border-border">
                                            {items.map((item, i) => {
                                                const extras = item.modifiers || item.extras || item.variantes || item.modificadores || []
                                                return (
                                                    <div key={i} className="bg-card/50">
                                                        <div className="p-3 flex justify-between items-start">
                                                            <span className="font-bold text-sm text-foreground">{item.quantity}x {item.product?.name || item.name}</span>
                                                            <span className="font-black text-sm text-foreground">
                                                                ${parseFloat((item.unit_price || item.price) * item.quantity).toFixed(2)}
                                                            </span>
                                                        </div>
                                                        {extras.length > 0 && (
                                                            <div className="px-3 pb-3 ml-4 space-y-1 border-l-2 border-primary/10">
                                                                {extras.map((ext, j) => {
                                                                    const isNote = !ext.price && !ext.extra_price && ext.value
                                                                    return (
                                                                        <div key={j} className={`flex justify-between items-start text-[11px] font-medium ${isNote ? 'text-amber-600 dark:text-amber-400 bg-amber-500/10 rounded-lg px-2 py-1' : 'text-muted-foreground'}`}>
                                                                            <div className="flex items-center gap-1.5">
                                                                                {isNote ? (
                                                                                    <span>📝 <strong>Instrucciones:</strong> {ext.value || ext.name}</span>
                                                                                ) : (
                                                                                    <><span className="w-1.5 h-1.5 rounded-full bg-primary/20 shrink-0" /><span>{ext.name || ext.nombre}</span></>
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

                                    {order.notes && (
                                        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
                                            <p className="text-sm text-amber-600 dark:text-amber-400"><strong>📝 Notas:</strong> {order.notes}</p>
                                        </div>
                                    )}

                                    {/* ── Actions Section ── */}
                                    {isActive && order.status !== 'delivered' && order.status !== 'cancelled' && (
                                        <div className="space-y-3">
                                            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Acciones</h3>

                                            {/* Primary: Next statuses */}
                                            {nextStatuses.length > 0 && (
                                                <div className="space-y-2">
                                                    {nextStatuses.map(next => {
                                                        const nextInfo = ORDER_STATUSES[next]
                                                        if (!nextInfo) return null
                                                        return (
                                                            <button
                                                                key={next}
                                                                onClick={() => handleStatusChange(next)}
                                                                disabled={isUpdating}
                                                                className="w-full flex items-center justify-between gap-3 py-3 px-4 rounded-xl font-black text-white text-sm hover:brightness-110 active:scale-[0.98] transition-all shadow-sm disabled:opacity-60"
                                                                style={{ background: nextInfo.color }}
                                                            >
                                                                <span>{nextInfo.emoji} Avanzar a: {nextInfo.label}</span>
                                                                <ArrowRight className="w-4 h-4 shrink-0" />
                                                            </button>
                                                        )
                                                    })}
                                                </div>
                                            )}

                                            {/* Admin override: full status grid */}
                                            {isAdmin && (
                                                <details className="group">
                                                    <summary className="text-xs font-bold text-muted-foreground hover:text-foreground cursor-pointer list-none flex items-center gap-1.5 py-1">
                                                        <span className="text-[10px] uppercase tracking-widest">Cambio manual de estado (Admin)</span>
                                                    </summary>
                                                    <div className="grid grid-cols-2 gap-2 mt-2">
                                                        {Object.entries(ORDER_STATUSES).map(([key, info]) => {
                                                            if (key === order.status) return null
                                                            return (
                                                                <button
                                                                    key={key}
                                                                    onClick={() => handleStatusChange(key)}
                                                                    disabled={isUpdating}
                                                                    className={`p-3 rounded-xl border border-border text-left transition-all hover:border-primary/50 hover:bg-primary/5 ${key === 'cancelled' ? 'hover:border-red-500/50 hover:bg-red-500/5' : ''}`}
                                                                >
                                                                    <div className="text-lg mb-1">{info.emoji}</div>
                                                                    <div className={`text-xs font-bold leading-tight ${key === 'cancelled' ? 'text-red-500' : 'text-foreground'}`}>
                                                                        {info.label}
                                                                    </div>
                                                                </button>
                                                            )
                                                        })}
                                                    </div>
                                                </details>
                                            )}

                                            {/* Cancel — always available */}
                                            <button
                                                onClick={() => {
                                                    if (confirm('¿Cancelar esta orden?')) handleStatusChange('cancelled')
                                                }}
                                                disabled={isUpdating}
                                                className="w-full py-2.5 rounded-xl text-sm font-bold text-red-500 bg-red-500/10 hover:bg-red-500/20 transition-colors border border-red-500/20 disabled:opacity-60"
                                            >
                                                ❌ Cancelar Orden
                                            </button>
                                        </div>
                                    )}

                                    {/* Por Liquidar Context: info badge + reopen */}
                                    {isPendingCut && (
                                        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-center">
                                            <p className="text-sm font-bold text-amber-600 dark:text-amber-400 mb-1">
                                                ⏳ Pendiente de Corte de Caja
                                            </p>
                                            <p className="text-xs text-muted-foreground mb-3">
                                                Esta orden se incluirá en el próximo corte de caja.
                                                {isAdmin && ' Como admin puedes reabrirla.'}
                                            </p>
                                            {isAdmin && onReopenOrder && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => {
                                                        if (confirm('¿Reabrir esta orden? Volverá al estado "Entregada" dentro de "Por Liquidar".')) {
                                                            onReopenOrder()
                                                        }
                                                    }}
                                                    className="w-full border-amber-500/30 text-amber-600 hover:bg-amber-500/10"
                                                >
                                                    <RotateCcw className="w-4 h-4 mr-2" /> Reabrir Orden (Admin)
                                                </Button>
                                            )}
                                        </div>
                                    )}

                                    {/* Historial Context: locked badge + admin reopen */}
                                    {isClosed && (
                                        <div className="bg-muted/50 border border-border rounded-xl p-4 text-center">
                                            <p className="text-sm font-bold text-muted-foreground mb-1">
                                                🔒 Incluida en Corte #{order.cash_cut_id?.slice(0, 8)}
                                            </p>
                                            <p className="text-xs text-muted-foreground mb-3">
                                                Esta orden fue liquidada formalmente.
                                                {isAdmin && ' Como admin puedes reabrirla.'}
                                            </p>
                                            {isAdmin && onReopenOrder && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => {
                                                        if (confirm('¿Reabrir esta orden? Se removerá del corte y volverá a "Por Liquidar".')) {
                                                            onReopenOrder()
                                                        }
                                                    }}
                                                    className="w-full border-amber-500/30 text-amber-600 hover:bg-amber-500/10"
                                                >
                                                    <RotateCcw className="w-4 h-4 mr-2" /> Reabrir Orden (Admin)
                                                </Button>
                                            )}
                                        </div>
                                    )}
                                </>
                            ) : (
                                /* Bitácora (Audit Log) */
                                <div className="space-y-4">
                                    <h3 className="text-sm font-bold text-foreground">Historial de Cambios</h3>
                                    {auditLog.length === 0 ? (
                                        <div className="text-center p-8 border border-border/50 border-dashed rounded-xl bg-muted/30">
                                            <History className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
                                            <p className="text-xs text-muted-foreground font-medium">No hay registros de auditoría.</p>
                                        </div>
                                    ) : (
                                        <div className="relative pl-4 space-y-6 before:absolute before:inset-y-0 before:left-[7px] before:w-[2px] before:bg-border/60">
                                            {auditLog.map((log, i) => (
                                                <div key={i} className="relative">
                                                    <div className="absolute left-[-23px] top-1 w-4 h-4 rounded-full bg-card border-2 border-primary ring-4 ring-card" />
                                                    <div className="bg-card border border-border/60 rounded-xl p-3 shadow-sm hover:border-primary/30 transition-colors">
                                                        <div className="flex justify-between items-start mb-1.5">
                                                            <span className="font-bold text-sm text-foreground">
                                                                {log.action === 'CREATED' ? '✨ Creación' :
                                                                    log.action === 'STATUS_CHANGE' ? '🔄 Cambio de Estado' :
                                                                        log.action === 'REOPENED' ? '↩️ Reabierta' :
                                                                            '✏️ Edición'}
                                                            </span>
                                                            <span className="text-[10px] uppercase font-black tracking-widest text-muted-foreground bg-muted px-2 py-0.5 rounded-md">
                                                                {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                            </span>
                                                        </div>
                                                        <p className="text-sm text-foreground mb-2">{log.details}</p>
                                                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground bg-muted/40 w-fit px-2 py-1 rounded-md">
                                                            <User className="w-3 h-3" />
                                                            {log.user}
                                                            {i === 0 && <span className="text-primary/70 ml-1">(Apertura)</span>}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                            <div className="relative pt-2">
                                                <div className="absolute left-[-21px] top-3 w-3 h-3 rounded-full bg-border" />
                                                <p className="text-[11px] font-black uppercase text-muted-foreground tracking-widest pl-2">Fin del historial</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Delete — ADMIN ONLY */}
                    {!isEditing && isAdmin && (
                        <div className="pt-4 border-t border-border">
                            {isClosed && (
                                <p className="text-[11px] text-amber-600 dark:text-amber-400 font-bold text-center mb-2 bg-amber-500/10 rounded-lg py-1.5 px-3">
                                    ⚠️ Esta orden está en el corte #{order.cash_cut_id?.slice(0, 8)}. Eliminarla afectará la integridad del corte.
                                </p>
                            )}
                            <button
                                onClick={() => {
                                    const msg = isClosed
                                        ? `⚠️ ADVERTENCIA: Esta orden está incluida en un corte de caja (#${order.cash_cut_id?.slice(0, 8)}). ¿Seguro que deseas eliminarla? Esta acción no se puede deshacer.`
                                        : '¿Eliminar esta orden? Esta acción no se puede deshacer.'
                                    if (confirm(msg)) onDelete()
                                }}
                                className="w-full py-3 rounded-xl text-sm font-bold text-red-500 bg-red-500/10 hover:bg-red-500/20 transition-colors flex items-center justify-center gap-2"
                            >
                                <Trash2 className="w-4 h-4" />
                                {isClosed ? '🔒 Eliminar del Historial (Admin)' : 'Eliminar Orden'}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
