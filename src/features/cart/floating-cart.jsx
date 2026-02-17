import { ShoppingCart, X, Plus, Minus, Trash2 } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { useCart } from './cart-context'
import { generateWhatsAppMessage, sendWhatsAppOrder } from '../../lib/whatsapp-service'
import { useState } from 'react'

export function FloatingCart({ restaurant }) {
    const { items, getItemCount, getTotal, updateQuantity, removeItem, clearCart } = useCart()
    const [isOpen, setIsOpen] = useState(false)
    const [customerName, setCustomerName] = useState('')

    const itemCount = getItemCount()
    const total = getTotal()

    const handleSendOrder = () => {
        if (!restaurant.phone) {
            alert('El restaurante no tiene un número de WhatsApp configurado')
            return
        }

        const message = generateWhatsAppMessage(items, restaurant.company_name || 'Restaurante', customerName)
        sendWhatsAppOrder(restaurant.phone, message)

        // Clear cart after sending
        clearCart()
        setIsOpen(false)
        setCustomerName('')
    }

    if (itemCount === 0 && !isOpen) return null

    return (
        <>
            {/* Floating Button */}
            {!isOpen && (
                <button
                    onClick={() => setIsOpen(true)}
                    className="fixed bottom-6 right-6 bg-orange-500 hover:bg-orange-600 text-white rounded-full p-4 shadow-lg transition-all z-50"
                >
                    <ShoppingCart className="w-6 h-6" />
                    {itemCount > 0 && (
                        <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                            {itemCount}
                        </span>
                    )}
                </button>
            )}

            {/* Cart Panel */}
            {isOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end sm:items-center justify-center">
                    <div className="bg-white w-full sm:max-w-md sm:rounded-lg max-h-[90vh] flex flex-col">
                        {/* Header */}
                        <div className="flex items-center justify-between p-4 border-b">
                            <h2 className="text-lg font-bold">Tu Pedido</h2>
                            <button onClick={() => setIsOpen(false)}>
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        {/* Items */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {items.length === 0 ? (
                                <div className="text-center py-12 text-gray-500">
                                    <ShoppingCart className="w-12 h-12 mx-auto mb-2 opacity-50" />
                                    <p>Tu carrito está vacío</p>
                                </div>
                            ) : (
                                items.map(item => (
                                    <div key={item.id} className="border rounded-lg p-3">
                                        <div className="flex items-start justify-between mb-2">
                                            <div className="flex-1">
                                                <h3 className="font-medium">{item.product.name}</h3>
                                                {item.modifiers.length > 0 && (
                                                    <ul className="text-xs text-gray-600 mt-1">
                                                        {item.modifiers.map((mod, i) => (
                                                            <li key={i}>
                                                                • {mod.name}
                                                                {mod.extra_price > 0 && ` (+$${mod.extra_price})`}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                )}
                                            </div>
                                            <button
                                                onClick={() => removeItem(item.id)}
                                                className="text-red-500 hover:text-red-700"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>

                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                                    className="w-7 h-7 rounded-full border flex items-center justify-center hover:bg-gray-100"
                                                >
                                                    <Minus className="w-3 h-3" />
                                                </button>
                                                <span className="w-8 text-center font-medium">{item.quantity}</span>
                                                <button
                                                    onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                                    className="w-7 h-7 rounded-full border flex items-center justify-center hover:bg-gray-100"
                                                >
                                                    <Plus className="w-3 h-3" />
                                                </button>
                                            </div>
                                            <span className="font-bold">${item.subtotal.toFixed(2)}</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Footer */}
                        {items.length > 0 && (
                            <div className="border-t p-4 space-y-3">
                                <div className="flex items-center justify-between text-lg font-bold">
                                    <span>Total:</span>
                                    <span>${total.toFixed(2)}</span>
                                </div>

                                <input
                                    type="text"
                                    placeholder="Tu nombre (opcional)"
                                    value={customerName}
                                    onChange={(e) => setCustomerName(e.target.value)}
                                    className="w-full px-3 py-2 border rounded-lg"
                                />

                                <Button
                                    onClick={handleSendOrder}
                                    className="w-full bg-green-600 hover:bg-green-700"
                                >
                                    Enviar Pedido por WhatsApp
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    )
}
