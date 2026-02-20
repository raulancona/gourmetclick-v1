import { Loader2, Check, Minus, Plus } from 'lucide-react'
import { Button } from '../../../components/ui/button'
import { Textarea } from '../../../components/ui/textarea'
import { Modal, ModalFooter } from '../../../components/ui/modal'
import { formatCurrency } from '../../../lib/utils'

export function ModifierModal({
    isOpen,
    onClose,
    product,
    fetchingModifiers,
    availableModifiers,
    selectedModifiers,
    onToggleModifier,
    customizations,
    onCustomizationsChange,
    quantity,
    onQuantityChange,
    onAddToCart
}) {
    if (!product) return null

    // Calculate total price based on product price + selected modifiers
    const extraTotal = selectedModifiers.reduce((acc, m) => acc + parseFloat(m.extra_price), 0)
    const unitPrice = parseFloat(product.price || 0) + extraTotal
    const totalPrice = unitPrice * quantity

    // Group modifiers by their groupName
    const groups = availableModifiers.reduce((acc, mod) => {
        const key = mod.groupName || 'Extras'
        if (!acc[key]) acc[key] = []
        acc[key].push(mod)
        return acc
    }, {})

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`Opciones: ${product.name}`}
        >
            <div className="space-y-5">
                {fetchingModifiers ? (
                    <div className="py-8 flex flex-col items-center justify-center gap-3">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        <p className="text-sm text-muted-foreground">Cargando opciones...</p>
                    </div>
                ) : (
                    <>
                        {availableModifiers.length > 0 ? (
                            Object.entries(groups).map(([groupName, mods]) => (
                                <div key={groupName} className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <div className="h-px flex-1 bg-border" />
                                        <span className="text-[11px] font-black text-muted-foreground uppercase tracking-widest px-2">{groupName}</span>
                                        <div className="h-px flex-1 bg-border" />
                                    </div>
                                    <div className="grid grid-cols-1 gap-2">
                                        {mods.map(mod => {
                                            const isSelected = !!selectedModifiers.find(m => m.id === mod.id)
                                            return (
                                                <button
                                                    key={mod.id}
                                                    onClick={() => onToggleModifier(mod)}
                                                    className={`flex items-center justify-between p-3.5 rounded-xl border-2 cursor-pointer transition-all text-left ${isSelected
                                                        ? 'border-primary bg-primary/5 shadow-sm'
                                                        : 'border-border hover:border-primary/40 bg-card'
                                                        }`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${isSelected ? 'border-primary bg-primary' : 'border-muted-foreground/40'}`}>
                                                            {isSelected && <Check className="w-3 h-3 text-primary-foreground" />}
                                                        </div>
                                                        <span className={`font-semibold text-sm ${isSelected ? 'text-foreground' : 'text-muted-foreground'}`}>{mod.name}</span>
                                                    </div>
                                                    {parseFloat(mod.extra_price) > 0 && (
                                                        <span className={`text-sm font-black shrink-0 ml-2 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`}>
                                                            +{formatCurrency(mod.extra_price)}
                                                        </span>
                                                    )}
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="text-sm text-muted-foreground text-center py-2">No hay extras configurados para este producto.</p>
                        )}

                        <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <div className="h-px flex-1 bg-border" />
                                <span className="text-[11px] font-black text-muted-foreground uppercase tracking-widest px-2">Instrucciones especiales</span>
                                <div className="h-px flex-1 bg-border" />
                            </div>
                            <Textarea
                                placeholder="Ej: Sin cebolla, poco picante, etc..."
                                value={customizations}
                                onChange={(e) => onCustomizationsChange(e.target.value)}
                                className="min-h-[80px] rounded-xl border-input bg-background"
                            />
                        </div>
                    </>
                )}
            </div>
            <ModalFooter className="mt-6">
                {/* Quantity selector in modal */}
                <div className="flex items-center gap-3 mr-auto">
                    <span className="text-xs font-bold text-muted-foreground uppercase">Cant.</span>
                    <div className="flex items-center gap-2 bg-muted rounded-xl p-1">
                        <button
                            onClick={() => onQuantityChange(Math.max(1, quantity - 1))}
                            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-card transition-colors text-foreground"
                        >
                            <Minus className="w-4 h-4" />
                        </button>
                        <span className="w-8 text-center font-black text-foreground">{quantity}</span>
                        <button
                            onClick={() => onQuantityChange(quantity + 1)}
                            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-card transition-colors text-foreground"
                        >
                            <Plus className="w-4 h-4" />
                        </button>
                    </div>
                </div>
                <Button variant="ghost" onClick={onClose} className="rounded-xl">
                    Cancelar
                </Button>
                <Button
                    onClick={onAddToCart}
                    className="rounded-xl px-8"
                    disabled={fetchingModifiers}
                >
                    Agregar {quantity > 1 ? `${quantity}x ` : ''}por {formatCurrency(totalPrice)}
                </Button>
            </ModalFooter>
        </Modal>
    )
}
