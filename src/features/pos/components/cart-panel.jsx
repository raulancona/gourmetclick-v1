import { useState } from 'react'
import { Trash2, ChevronRight, Package, Minus, Plus, Armchair, Banknote, CreditCard, Landmark, Loader2 } from 'lucide-react'
import { Button } from '../../../components/ui/button'
import { Input } from '../../../components/ui/input'
import { Label } from '../../../components/ui/label'
import { Textarea } from '../../../components/ui/textarea'
import { formatCurrency } from '../../../lib/utils'
import { PaymentModal } from './payment-modal'

export function CartPanel({
    cart,
    cartItemCount,
    cartTotal,
    editingOrder,
    onCancelEdit,
    onClearCart,
    showMobileCart,
    setShowMobileCart,
    customerName,
    setCustomerName,
    orderType,
    setOrderType,
    tableNumber,
    setTableNumber,
    notes,
    setNotes,
    paymentMethod,
    setPaymentMethod,
    montoRecibido,
    setMontoRecibido,
    updateQuantity,
    isSubmitting,
    handleCreateOrder,
    submitLabel = 'Cobrar Orden'
}) {
    const [showPaymentModal, setShowPaymentModal] = useState(false)

    // When user clicks "Cobrar Orden" → open modal instead of direct submit
    const handleCobrарClick = () => {
        if (cart.length === 0) return
        setShowPaymentModal(true)
    }

    // Called from PaymentModal when the user confirms payment
    const handlePaymentConfirm = ({ montoRecibido: monto }) => {
        setMontoRecibido(String(monto))
        setShowPaymentModal(false)
        // Small delay to allow state update before submit
        setTimeout(() => handleCreateOrder(), 50)
    }

    return (
        <>
            <div className={`
                    fixed inset-y-0 right-0 w-full md:w-[420px] bg-card/95 backdrop-blur-xl shadow-2xl z-30 flex flex-col border-l border-border h-full transition-transform duration-300
                    ${showMobileCart ? 'translate-x-0' : 'translate-x-full md:translate-x-0 md:static md:inset-auto'}
                `}>
                {/* 1. FIXED HEADER */}
                <div className="p-4 shrink-0 bg-card border-b border-border z-10">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <h2 className="text-lg font-bold text-foreground">Orden Actual</h2>
                            <span className="bg-primary/10 text-primary text-xs font-bold px-2 py-0.5 rounded-full">{cartItemCount} Items</span>
                        </div>
                        <div className="flex items-center gap-1">
                            {(cart.length > 0 || editingOrder) && (
                                <button
                                    onClick={() => editingOrder ? onCancelEdit() : (confirm('¿Vaciar carrito?') && onClearCart())}
                                    className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                                    title="Vaciar"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            )}
                            <button
                                onClick={() => setShowMobileCart(false)}
                                className="md:hidden p-2 text-muted-foreground hover:bg-muted rounded-lg"
                            >
                                <ChevronRight className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Customer & Type */}
                    <div className="space-y-3">
                        <Input
                            value={customerName}
                            onChange={(e) => setCustomerName(e.target.value)}
                            placeholder="Nombre del cliente..."
                            className="bg-muted/50 border-transparent focus:bg-background transition-colors h-9 text-sm"
                        />
                        <div className="grid grid-cols-3 gap-1 bg-muted/50 p-1 rounded-lg">
                            {['dine_in', 'pickup', 'delivery'].map(type => (
                                <button
                                    key={type}
                                    onClick={() => setOrderType(type)}
                                    className={`py-1.5 text-xs font-semibold rounded-md transition-all ${orderType === type
                                        ? 'bg-background text-foreground shadow-sm'
                                        : 'text-muted-foreground hover:text-foreground'
                                        }`}
                                >
                                    {type === 'dine_in' ? 'Mesa' : type === 'pickup' ? 'Para Llevar' : 'Domicilio'}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* 2. SCROLLABLE CONTENT */}
                <div className="flex-1 overflow-y-auto min-h-0 bg-muted/10">
                    <div className="p-4 space-y-6">
                        {/* Cart Items List */}
                        <div className="space-y-3">
                            {cart.map((item, index) => (
                                <div key={item.id || index} className="group flex gap-3 bg-card p-2 rounded-xl border border-transparent hover:border-border transition-colors">
                                    <div className="w-12 h-12 rounded-lg bg-muted overflow-hidden shrink-0 relative">
                                        {item.image_url ? (
                                            <img src={item.image_url} className="w-full h-full object-cover" alt="" />
                                        ) : (
                                            <Package className="w-5 h-5 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-muted-foreground/50" />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                                        <div className="flex justify-between items-start">
                                            <h4 className="font-semibold text-sm text-foreground truncate max-w-[140px] leading-tight">{item.name}</h4>
                                            <span className="font-bold text-sm text-foreground tabular-nums">{formatCurrency(item.price * item.quantity)}</span>
                                        </div>
                                        <div className="flex items-center justify-between mt-1">
                                            <p className="text-[10px] text-muted-foreground line-clamp-1">
                                                {item.modifiers?.map(m => m.name).join(', ') || 'Sin extras'}
                                            </p>
                                            <div className="flex items-center gap-2 bg-muted/50 rounded-md px-1 h-6">
                                                <button onClick={() => updateQuantity(item.id, -1)} className="w-5 hover:text-primary transition-colors disabled:opacity-50"><Minus className="w-3 h-3" /></button>
                                                <span className="text-xs font-bold w-3 text-center">{item.quantity}</span>
                                                <button onClick={() => updateQuantity(item.id, 1)} className="w-5 hover:text-primary transition-colors"><Plus className="w-3 h-3" /></button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {cart.length === 0 && (
                                <div className="py-12 flex flex-col items-center justify-center text-muted-foreground/40 text-center">
                                    <Package className="w-12 h-12 mb-3 opacity-20" />
                                    <p className="text-sm font-medium">Su carrito está vacío</p>
                                    <p className="text-xs">Agregue productos para comenzar</p>
                                </div>
                            )}
                        </div>

                        {/* Order Details */}
                        {cart.length > 0 && (
                            <div className="space-y-4 pt-2">
                                <div className="flex items-center gap-2 pb-2 border-b border-border/50">
                                    <span className="text-[10px] font-black uppercase text-muted-foreground tracking-wider">Detalles de Venta</span>
                                </div>

                                {/* Table Number */}
                                {orderType === 'dine_in' && (
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-semibold text-foreground">Número de Mesa</Label>
                                        <div className="relative">
                                            <Armchair className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                            <Input
                                                value={tableNumber}
                                                onChange={e => setTableNumber(e.target.value)}
                                                placeholder="Ej. 12"
                                                className="pl-9 bg-card"
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Notes */}
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-medium text-muted-foreground">Notas Generales</Label>
                                    <Textarea
                                        value={notes}
                                        onChange={e => setNotes(e.target.value)}
                                        placeholder="Instrucciones especiales para la cocina..."
                                        className="h-20 bg-card resize-none text-xs"
                                    />
                                </div>

                                {/* Payment Method — simplified selection (no cash inputs here, those move to modal) */}
                                <div className="space-y-2 pt-2">
                                    <Label className="text-xs font-semibold text-foreground">Método de Pago</Label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {[
                                            { id: 'cash', label: 'Efectivo', icon: Banknote },
                                            { id: 'card', label: 'Tarjeta', icon: CreditCard },
                                            { id: 'transfer', label: 'Transf.', icon: Landmark },
                                        ].map((method) => (
                                            <button
                                                key={method.id}
                                                onClick={() => setPaymentMethod(method.id)}
                                                className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all gap-1.5 ${paymentMethod === method.id
                                                    ? 'border-primary bg-primary/5 text-primary shadow-sm'
                                                    : 'border-border bg-card text-muted-foreground hover:bg-muted'
                                                    }`}
                                            >
                                                <method.icon className="w-5 h-5" />
                                                <span className="text-[10px] font-bold">{method.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                        <div className="h-4" />
                    </div>
                </div>

                {/* 3. FIXED FOOTER */}
                <div className="shrink-0 p-4 bg-card border-t border-border shadow-[0_-5px_20px_-10px_rgba(0,0,0,0.1)] z-20">
                    <div className="space-y-1 mb-4">
                        <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Subtotal</span>
                            <span>{formatCurrency(cartTotal)}</span>
                        </div>
                        <div className="flex justify-between items-end">
                            <span className="text-sm font-bold text-foreground">Total a Pagar</span>
                            <span className="text-2xl font-black text-foreground tracking-tight">{formatCurrency(cartTotal)}</span>
                        </div>
                    </div>

                    <Button
                        className="w-full h-12 text-base font-bold shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all rounded-xl"
                        onClick={editingOrder ? handleCreateOrder : handleCobrарClick}
                        disabled={cart.length === 0 || isSubmitting}
                    >
                        {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                            editingOrder ? 'Actualizar Orden' : submitLabel
                        )}
                    </Button>
                </div>
            </div>

            {/* Smart Payment Modal */}
            <PaymentModal
                isOpen={showPaymentModal}
                onClose={() => setShowPaymentModal(false)}
                total={cartTotal}
                paymentMethod={paymentMethod}
                onConfirm={handlePaymentConfirm}
                isSubmitting={isSubmitting}
            />
        </>
    )
}
