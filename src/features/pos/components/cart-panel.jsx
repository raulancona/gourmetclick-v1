import { useState } from 'react'
import {
    Trash2, ChevronRight, Package, Minus, Plus,
    Armchair, Banknote, CreditCard, Landmark, Loader2,
    Phone, MapPin, Bike, ShoppingBag, UtensilsCrossed, Truck
} from 'lucide-react'
import { Button } from '../../../components/ui/button'
import { Input } from '../../../components/ui/input'
import { Label } from '../../../components/ui/label'
import { Textarea } from '../../../components/ui/textarea'
import { formatCurrency } from '../../../lib/utils'
import { PaymentModal } from './payment-modal'
import { cn } from '../../../lib/utils'

// Order type config
const ORDER_TYPES = [
    {
        id: 'dine_in',
        label: 'Mesa',
        icon: UtensilsCrossed,
        color: 'from-blue-500 to-indigo-600',
        activeBg: 'bg-gradient-to-br from-blue-500 to-indigo-600',
        textColor: 'text-white'
    },
    {
        id: 'pickup',
        label: 'Para Llevar',
        icon: ShoppingBag,
        color: 'from-emerald-500 to-teal-600',
        activeBg: 'bg-gradient-to-br from-emerald-500 to-teal-600',
        textColor: 'text-white'
    },
    {
        id: 'delivery',
        label: 'Domicilio',
        icon: Bike,
        color: 'from-violet-500 to-purple-600',
        activeBg: 'bg-gradient-to-br from-violet-500 to-purple-600',
        textColor: 'text-white'
    },
]

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
    customerPhone,
    setCustomerPhone,
    orderType,
    setOrderType,
    tableNumber,
    setTableNumber,
    deliveryAddress,
    setDeliveryAddress,
    deliveryFee,
    setDeliveryFee,
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

    const activeType = ORDER_TYPES.find(t => t.id === orderType)
    const feeAmount = parseFloat(deliveryFee) || 0
    const grandTotal = cartTotal + feeAmount

    const handleCobrarClick = () => {
        if (cart.length === 0) return
        setShowPaymentModal(true)
    }

    const handlePaymentConfirm = ({ montoRecibido: monto }) => {
        setMontoRecibido(String(monto))
        setShowPaymentModal(false)
        setTimeout(() => handleCreateOrder(), 50)
    }

    const submitButtonLabel = editingOrder ? 'Actualizar Orden' :
        orderType === 'dine_in' ? 'Cobrar Orden' :
            orderType === 'pickup' ? '✓ Orden Lista' :
                '🏍️ Confirmar Pedido'

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

                    {/* ORDER TYPE SELECTOR */}
                    <div className="grid grid-cols-3 gap-1.5 bg-muted/50 p-1.5 rounded-2xl border border-border/40 mb-3">
                        {ORDER_TYPES.map(type => {
                            const isActive = orderType === type.id
                            return (
                                <button
                                    key={type.id}
                                    onClick={() => setOrderType(type.id)}
                                    className={cn(
                                        "flex flex-col items-center gap-1 py-2 px-1 rounded-xl text-xs font-bold transition-all duration-200",
                                        isActive
                                            ? `${type.activeBg} ${type.textColor} shadow-md`
                                            : "text-muted-foreground hover:text-foreground hover:bg-background/60"
                                    )}
                                >
                                    <type.icon className="w-4 h-4" />
                                    <span>{type.label}</span>
                                </button>
                            )
                        })}
                    </div>

                    {/* CUSTOMER NAME — always visible */}
                    <Input
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder={orderType === 'dine_in' ? 'Nombre del cliente (opcional)...' : 'Nombre del cliente *'}
                        className="bg-muted/50 border-transparent focus:bg-background transition-colors h-9 text-sm"
                    />
                </div>

                {/* 2. SCROLLABLE CONTENT */}
                <div className="flex-1 overflow-y-auto min-h-0 bg-muted/10">
                    <div className="p-4 space-y-5">

                        {/* CART ITEMS */}
                        <div className="space-y-2">
                            {cart.map((item, index) => (
                                <div key={item.id || index} className="group flex gap-3 bg-card p-2 rounded-xl border border-transparent hover:border-border transition-colors">
                                    <div className="w-11 h-11 rounded-lg bg-muted overflow-hidden shrink-0 relative">
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
                                                <button onClick={() => updateQuantity(item.id, -1)} className="w-5 hover:text-primary transition-colors"><Minus className="w-3 h-3" /></button>
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

                        {/* ORDER DETAILS — dynamic per type */}
                        {cart.length > 0 && (
                            <div className="space-y-3 pt-1">
                                <div className="flex items-center gap-2 pb-1 border-b border-border/50">
                                    {activeType && <activeType.icon className="w-3.5 h-3.5 text-muted-foreground" />}
                                    <span className="text-[10px] font-black uppercase text-muted-foreground tracking-wider">
                                        Detalles — {activeType?.label}
                                    </span>
                                </div>

                                {/* DINE_IN: Table number */}
                                {orderType === 'dine_in' && (
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                                            <Armchair className="w-3.5 h-3.5" /> Número de Mesa <span className="text-red-500">*</span>
                                        </Label>
                                        <Input
                                            value={tableNumber}
                                            onChange={e => setTableNumber(e.target.value)}
                                            placeholder="Ej. 5 / Terraza / Barra"
                                            className="bg-card h-10"
                                        />
                                    </div>
                                )}

                                {/* PICKUP: Phone (optional) */}
                                {orderType === 'pickup' && (
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                                            <Phone className="w-3.5 h-3.5" /> Teléfono (opcional)
                                        </Label>
                                        <Input
                                            value={customerPhone}
                                            onChange={e => setCustomerPhone(e.target.value)}
                                            placeholder="55 1234 5678"
                                            type="tel"
                                            className="bg-card h-10"
                                        />
                                    </div>
                                )}

                                {/* DELIVERY: Phone + Address + Fee */}
                                {orderType === 'delivery' && (
                                    <div className="space-y-3">
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                                                <Phone className="w-3.5 h-3.5" /> Teléfono <span className="text-red-500">*</span>
                                            </Label>
                                            <Input
                                                value={customerPhone}
                                                onChange={e => setCustomerPhone(e.target.value)}
                                                placeholder="55 1234 5678"
                                                type="tel"
                                                className="bg-card h-10"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                                                <MapPin className="w-3.5 h-3.5" /> Dirección de Entrega <span className="text-red-500">*</span>
                                            </Label>
                                            <Textarea
                                                value={deliveryAddress}
                                                onChange={e => setDeliveryAddress(e.target.value)}
                                                placeholder="Calle, número, colonia, referencias..."
                                                className="bg-card resize-none h-16 text-sm"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                                                <Truck className="w-3.5 h-3.5" /> Cargo de Envío
                                            </Label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-sm">$</span>
                                                <Input
                                                    value={deliveryFee}
                                                    onChange={e => setDeliveryFee(e.target.value)}
                                                    type="number"
                                                    min="0"
                                                    step="5"
                                                    placeholder="0.00"
                                                    className="bg-card h-10 pl-7"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* NOTES — always */}
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-medium text-muted-foreground">Notas para cocina</Label>
                                    <Textarea
                                        value={notes}
                                        onChange={e => setNotes(e.target.value)}
                                        placeholder="Sin picante, alérgenos, instrucciones..."
                                        className="h-16 bg-card resize-none text-xs"
                                    />
                                </div>

                                {/* PAYMENT METHOD */}
                                <div className="space-y-2 pt-1">
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
                                                className={cn(
                                                    "flex flex-col items-center justify-center p-3 rounded-xl border transition-all gap-1.5",
                                                    paymentMethod === method.id
                                                        ? 'border-primary bg-primary/5 text-primary shadow-sm'
                                                        : 'border-border bg-card text-muted-foreground hover:bg-muted'
                                                )}
                                            >
                                                <method.icon className="w-5 h-5" />
                                                <span className="text-[10px] font-bold">{method.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                        <div className="h-2" />
                    </div>
                </div>

                {/* 3. FIXED FOOTER */}
                <div className="shrink-0 p-4 bg-card border-t border-border shadow-[0_-5px_20px_-10px_rgba(0,0,0,0.1)] z-20">
                    <div className="space-y-1 mb-3">
                        <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Subtotal</span>
                            <span>{formatCurrency(cartTotal)}</span>
                        </div>
                        {orderType === 'delivery' && feeAmount > 0 && (
                            <div className="flex justify-between text-xs text-muted-foreground">
                                <span className="flex items-center gap-1"><Truck className="w-3 h-3" /> Cargo de envío</span>
                                <span>+{formatCurrency(feeAmount)}</span>
                            </div>
                        )}
                        <div className="flex justify-between items-end pt-1 border-t border-border/40">
                            <span className="text-sm font-bold text-foreground">Total a Pagar</span>
                            <span className="text-2xl font-black text-foreground tracking-tight">{formatCurrency(grandTotal)}</span>
                        </div>
                    </div>

                    <Button
                        className={cn(
                            "w-full h-12 text-base font-bold transition-all rounded-xl shadow-lg",
                            orderType === 'dine_in' && "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-blue-500/20",
                            orderType === 'pickup' && "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-emerald-500/20",
                            orderType === 'delivery' && "bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 shadow-violet-500/20"
                        )}
                        onClick={editingOrder ? handleCreateOrder : handleCobrarClick}
                        disabled={cart.length === 0 || isSubmitting}
                    >
                        {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : submitButtonLabel}
                    </Button>
                </div>
            </div>

            {/* Smart Payment Modal */}
            <PaymentModal
                isOpen={showPaymentModal}
                onClose={() => setShowPaymentModal(false)}
                total={grandTotal}
                paymentMethod={paymentMethod}
                onConfirm={handlePaymentConfirm}
                isSubmitting={isSubmitting}
            />
        </>
    )
}
