import { useState, useEffect, useRef } from 'react'
import {
    Search, ShoppingBag, Trash2, Plus, Minus, UtensilsCrossed,
    Truck, Armchair, Store, CreditCard, Banknote, Landmark,
    ChevronRight, Loader2, ArrowLeft, Package
} from 'lucide-react'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Textarea } from '../components/ui/textarea'
import { getProducts } from '../lib/product-service'
import { getCategories } from '../lib/category-service'
import { createOrder, updateOrder } from '../lib/order-service'
import { toast } from 'sonner'
import { formatCurrency } from '../lib/utils'
import { useAuth } from '../features/auth/auth-context'
import { supabase } from '../lib/supabase'
import { useCategorySubscription } from '../hooks/use-category-subscription'

export default function POSPage() {
    const { user, signOut } = useAuth()
    const [loading, setLoading] = useState(true)
    const [products, setProducts] = useState([])
    const [categories, setCategories] = useState([])
    const [selectedCategory, setSelectedCategory] = useState('all')
    const [searchTerm, setSearchTerm] = useState('')
    const [cart, setCart] = useState([])
    const [showMobileCart, setShowMobileCart] = useState(false)
    const [orderType, setOrderType] = useState('dine_in')
    const [paymentMethod, setPaymentMethod] = useState('cash')
    const [customerName, setCustomerName] = useState('')
    const [tableNumber, setTableNumber] = useState('')
    const [deliveryAddress, setDeliveryAddress] = useState('')
    const [notes, setNotes] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)

    const [editingOrder, setEditingOrder] = useState(null)

    // Realtime subscription
    useCategorySubscription(user?.id)

    useEffect(() => {
        const checkEditMode = () => {
            const editOrderStr = localStorage.getItem('edit_order')
            if (editOrderStr) {
                try {
                    const order = JSON.parse(editOrderStr)
                    setEditingOrder(order)

                    // Map order items back to cart structure
                    const restoredCart = (order.items || []).map(item => ({
                        ...item,
                        // Ensure we have compatible fields even if some are missing in legacy data
                        id: item.id || `temp-${Date.now()}-${Math.random()}`,
                        quantity: item.quantity || 1,
                        price: item.price || 0,
                        name: item.name || 'Producto desconocido',
                        modifiers: item.modifiers || []
                    }))

                    setCart(restoredCart)
                    setCustomerName(order.customer_name || '')
                    setOrderType(order.order_type || 'dine_in')
                    setTableNumber(order.table_number || '')
                    setDeliveryAddress(order.delivery_address || '')
                    setNotes(order.notes || '')

                    toast.info(`Editando orden #${order.id.slice(0, 6)}`, { duration: 5000 })
                    localStorage.removeItem('edit_order')
                } catch (e) {
                    console.error('Error loading edit order:', e)
                    toast.error('Error al cargar la orden para editar')
                }
            }
        }
        checkEditMode()
    }, [])

    useEffect(() => {
        loadData()
    }, [user])

    const loadData = async () => {
        try {
            setLoading(true)
            const [prods, cats] = await Promise.all([
                getProducts(user.id),
                getCategories(user.id)
            ])
            setProducts(prods)
            setCategories(cats)
        } catch (error) {
            console.error('Error loading POS data:', error)
            toast.error('Error al cargar productos')
        } finally {
            setLoading(false)
        }
    }

    const filteredProducts = products.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase())
        const matchesCategory = selectedCategory === 'all' || p.category_id === selectedCategory
        return matchesSearch && matchesCategory
    })

    const addToCart = (product) => {
        setCart(prev => {
            const existing = prev.find(item => item.id === product.id)
            if (existing) {
                return prev.map(item =>
                    item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
                )
            }
            return [...prev, { ...product, quantity: 1 }]
        })
    }

    const removeFromCart = (productId) => {
        setCart(prev => prev.filter(item => item.id !== productId))
    }

    const updateQuantity = (productId, delta) => {
        setCart(prev => prev.map(item => {
            if (item.id === productId) {
                const newQty = Math.max(1, item.quantity + delta)
                return { ...item, quantity: newQty }
            }
            return item
        }))
    }

    const cartTotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0)
    const cartItemCount = cart.reduce((acc, item) => acc + item.quantity, 0)

    const handleCreateOrder = async () => {
        if (cart.length === 0) {
            toast.error('El carrito está vacío')
            return
        }

        if (orderType === 'dine_in' && !tableNumber) {
            toast.error('Indique el número de mesa')
            return
        }

        try {
            setIsSubmitting(true)
            const orderData = {
                user_id: user.id,
                customer_name: customerName || 'Cliente General',
                order_type: orderType,
                payment_method: paymentMethod,
                status: editingOrder ? editingOrder.status : 'confirmed',
                total: cartTotal,
                items: cart.map(item => ({
                    id: item.id,
                    name: item.name,
                    price: item.price,
                    image_url: item.image_url,
                    quantity: item.quantity,
                    modifiers: item.modifiers
                })),
                delivery_address: orderType === 'delivery' ? deliveryAddress : null,
                table_number: orderType === 'dine_in' ? tableNumber : null,
                notes: notes || null
            }

            if (editingOrder) {
                await updateOrder(editingOrder.id, orderData, user.id)
                toast.success('Orden actualizada correctamente')
                setEditingOrder(null)
            } else {
                await createOrder(orderData)
                toast.success('Orden procesada correctamente')
            }

            setCart([])
            setCustomerName('')
            setTableNumber('')
            setDeliveryAddress('')
            setNotes('')
            setShowMobileCart(false)
        } catch (error) {
            console.error(error)
            toast.error('Error al procesar la orden')
        } finally {
            setIsSubmitting(false)
        }
    }

    const cancelEdit = () => {
        if (confirm('¿Cancelar edición? Se perderán los cambios no guardados.')) {
            setEditingOrder(null)
            setCart([])
            setCustomerName('')
            setTableNumber('')
            setDeliveryAddress('')
            setNotes('')
            toast.info('Modo edición cancelado')
        }
    }

    // Drag to scroll implementation
    const scrollContainerRef = useRef(null)
    const [isDragging, setIsDragging] = useState(false)
    const [startX, setStartX] = useState(0)
    const [scrollLeft, setScrollLeft] = useState(0)

    const handleMouseDown = (e) => {
        setIsDragging(true)
        setStartX(e.pageX - scrollContainerRef.current.offsetLeft)
        setScrollLeft(scrollContainerRef.current.scrollLeft)
    }

    // Attach listeners to document to handle drag outside container
    useEffect(() => {
        const handleMouseMove = (e) => {
            if (!isDragging) return
            e.preventDefault()
            const x = e.pageX - scrollContainerRef.current.offsetLeft
            const walk = (x - startX) * 2 // Scroll-fast
            scrollContainerRef.current.scrollLeft = scrollLeft - walk
        }

        const handleMouseUp = () => {
            setIsDragging(false)
        }

        if (isDragging) {
            document.addEventListener('mousemove', handleMouseMove)
            document.addEventListener('mouseup', handleMouseUp)
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove)
            document.removeEventListener('mouseup', handleMouseUp)
        }
    }, [isDragging, startX, scrollLeft])

    return (
        <div className="flex h-full bg-gray-100 overflow-hidden font-sans">
            {/* Sidebar is now handled by DashboardLayout */}

            {/* 2. Main Product Area (Middle) */}
            <div className="flex-1 flex flex-col min-w-0 bg-gray-50/50">
                {/* Header */}
                <div className="h-20 px-6 flex items-center justify-between shrink-0">
                    <div>
                        <h1 className="text-xl font-bold text-gray-900">
                            {editingOrder ? `Editando Orden #${editingOrder.id.slice(0, 6)}` : 'Punto de Venta'}
                        </h1>
                        <p className="text-xs text-gray-500">{new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                    </div>
                    <div className="relative w-64 lg:w-80">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            className="w-full h-10 pl-10 pr-4 rounded-full border-none bg-white shadow-sm text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                            placeholder="Buscar productos..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                {/* Categories */}
                <div className="px-6 mb-4 shrink-0">
                    <div
                        ref={scrollContainerRef}
                        className="flex gap-2 overflow-x-auto pb-2 no-scrollbar cursor-grab active:cursor-grabbing select-none"
                        onMouseDown={handleMouseDown}
                    >
                        <CategoryPill
                            label="Todos"
                            active={selectedCategory === 'all'}
                            onClick={() => setSelectedCategory('all')}
                        />
                        {categories.map(cat => (
                            <CategoryPill
                                key={cat.id}
                                label={cat.name}
                                active={selectedCategory === cat.id}
                                onClick={() => !isDragging && setSelectedCategory(cat.id)}
                            />
                        ))}
                    </div>
                </div>

                {/* Grid */}
                <div className="flex-1 overflow-y-auto px-6 pb-6">
                    {loading ? (
                        <div className="h-full flex items-center justify-center">
                            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                            {filteredProducts.map(product => (
                                <div
                                    key={product.id}
                                    onClick={() => addToCart(product)}
                                    className="group bg-white rounded-2xl p-3 shadow-sm border border-transparent hover:border-primary/20 hover:shadow-md transition-all cursor-pointer flex flex-col"
                                >
                                    <div className="aspect-square rounded-xl bg-gray-100 mb-3 overflow-hidden">
                                        {product.image_url ? (
                                            <img src={product.image_url} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-gray-300">
                                                <Package className="w-8 h-8" />
                                            </div>
                                        )}
                                    </div>
                                    <h3 className="font-semibold text-gray-900 text-sm mb-1 leading-snug line-clamp-2">{product.name}</h3>
                                    <div className="mt-auto flex items-center justify-between">
                                        <span className="font-bold text-gray-900">{formatCurrency(product.price)}</span>
                                        <button className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 group-hover:bg-primary group-hover:text-white transition-colors">
                                            <Plus className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* 3. Cart Panel (Right) */}
            <div className={`
                fixed inset-y-0 right-0 w-full sm:w-[400px] bg-white shadow-2xl transform transition-transform duration-300 z-30 flex flex-col
                ${showMobileCart ? 'translate-x-0' : 'translate-x-full lg:static lg:translate-x-0 lg:shadow-none lg:border-l lg:border-gray-100'}
            `}>
                {/* Cart Header */}
                <div className="p-6 pb-4 shrink-0 bg-white z-10">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <h2 className="text-xl font-bold text-gray-900">Orden Actual</h2>
                            <span className="bg-primary/10 text-primary text-xs font-bold px-2.5 py-1 rounded-full">{cartItemCount} Items</span>
                        </div>
                        <div className="flex items-center gap-2">
                            {/* Clear Cart / Cancel Edit */}
                            {(cart.length > 0 || editingOrder) && (
                                <button
                                    onClick={() => editingOrder ? cancelEdit() : (confirm('¿Vaciar carrito?') && setCart([]))}
                                    className={`p-2 rounded-lg transition-colors ${editingOrder ? 'text-orange-500 hover:bg-orange-50' : 'text-gray-400 hover:text-red-500 hover:bg-red-50'}`}
                                    title={editingOrder ? "Cancelar Edición" : "Vaciar carrito"}
                                >
                                    {editingOrder ? <Trash2 className="w-5 h-5" /> : <Trash2 className="w-5 h-5" />}
                                </button>
                            )}
                            {/* Mobile Close Button */}
                            <button
                                onClick={() => setShowMobileCart(false)}
                                className="lg:hidden p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <ChevronRight className="w-6 h-6" />
                            </button>
                        </div>
                    </div>

                    {/* Customer Input */}
                    <div className="mb-4">
                        <Input
                            value={customerName}
                            onChange={(e) => setCustomerName(e.target.value)}
                            placeholder="Nombre del cliente..."
                            className="bg-gray-50 border-transparent focus:bg-white transition-all rounded-xl"
                        />
                    </div>

                    {/* User / Settings Mini Bar */}
                    <div className="bg-gray-50 rounded-xl p-1.5 flex gap-2">
                        <button
                            onClick={() => setOrderType('dine_in')}
                            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${orderType === 'dine_in' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-900'}`}
                        >
                            Mesa
                        </button>
                        <button
                            onClick={() => setOrderType('pickup')}
                            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${orderType === 'pickup' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-900'}`}
                        >
                            Llevar
                        </button>
                        <button
                            onClick={() => setOrderType('delivery')}
                            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${orderType === 'delivery' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-900'}`}
                        >
                            Envío
                        </button>
                    </div>
                </div>

                {/* Cart Items */}
                <div className="flex-1 overflow-y-auto px-6 space-y-4">
                    {cart.map(item => (
                        <div key={item.id} className="flex gap-3">
                            <div className="w-14 h-14 rounded-lg bg-gray-100 overflow-hidden shrink-0">
                                {item.image_url && <img src={item.image_url} className="w-full h-full object-cover" />}
                            </div>
                            <div className="flex-1 min-w-0 flex flex-col justify-center">
                                <h4 className="font-semibold text-sm text-gray-900 truncate">{item.name}</h4>
                                <p className="text-xs text-gray-500">{formatCurrency(item.price)}</p>
                            </div>
                            <div className="flex flex-col items-end justify-center gap-1">
                                <span className="font-bold text-sm text-gray-900">{formatCurrency(item.price * item.quantity)}</span>
                                <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-0.5">
                                    <button onClick={() => updateQuantity(item.id, -1)} className="w-5 h-5 flex items-center justify-center text-gray-500 hover:bg-white hover:shadow-sm rounded-md transition-all"><Minus className="w-3 h-3" /></button>
                                    <span className="text-xs font-bold w-4 text-center">{item.quantity}</span>
                                    <button onClick={() => updateQuantity(item.id, 1)} className="w-5 h-5 flex items-center justify-center text-gray-500 hover:bg-white hover:shadow-sm rounded-md transition-all"><Plus className="w-3 h-3" /></button>
                                </div>
                            </div>
                        </div>
                    ))}

                    {cart.length === 0 && (
                        <div className="h-40 flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-100 rounded-xl my-4">
                            <ShoppingBag className="w-8 h-8 mb-2 opacity-50" />
                            <p className="text-sm">Carrito vacío</p>
                        </div>
                    )}
                </div>

                {/* Footer / Checkout */}
                <div className="p-6 bg-white border-t border-gray-100 shrink-0 space-y-4">
                    {/* Inputs specific to order type */}
                    {orderType === 'dine_in' && (
                        <div className="flex items-center gap-3 bg-gray-50 p-2 rounded-xl">
                            <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-gray-500"><Armchair className="w-4 h-4" /></div>
                            <Input
                                placeholder="Número de Mesa"
                                value={tableNumber}
                                onChange={e => setTableNumber(e.target.value)}
                                className="border-none bg-transparent h-8 focus-visible:ring-0 placeholder:text-gray-400 font-medium"
                            />
                        </div>
                    )}

                    {/* Notes Input */}
                    <div className="pt-2">
                        <Textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Notas de la orden (opcional)..."
                            className="min-h-[60px] text-xs bg-gray-50 border-none resize-none focus:ring-1 focus:ring-primary/20"
                        />
                    </div>

                    {/* Totals */}
                    <div className="space-y-2 py-2">
                        <div className="flex justify-between text-sm text-gray-500">
                            <span>Subtotal</span>
                            <span>{formatCurrency(cartTotal)}</span>
                        </div>
                        <div className="flex justify-between text-base font-black text-gray-900 pt-2 border-t border-gray-100">
                            <span>Total</span>
                            <span>{formatCurrency(cartTotal)}</span>
                        </div>
                    </div>

                    {/* Pay Button */}
                    <Button
                        className="w-full h-12 rounded-xl bg-gray-900 text-white hover:bg-black transition-all shadow-lg shadow-gray-200"
                        onClick={handleCreateOrder}
                        disabled={cart.length === 0 || isSubmitting}
                    >
                        {isSubmitting ? (<Loader2 className="w-5 h-5 animate-spin" />) : (
                            <div className="flex items-center justify-between w-full px-2">
                                <span>{editingOrder ? 'Actualizar Orden' : 'Procesar Venta'}</span>
                                <ArrowLeft className="w-5 h-5 rotate-180" />
                            </div>
                        )}
                    </Button>
                </div>
            </div>

            {/* Mobile Toggle Button */}
            <div className={`fixed bottom-4 right-4 lg:hidden z-40 transition-transform duration-300 ${showMobileCart ? 'translate-x-[200%] opacity-0' : 'translate-x-0 opacity-100'}`}>
                <Button
                    className="h-14 w-14 rounded-full shadow-2xl bg-gray-900 text-white flex items-center justify-center relative"
                    onClick={() => setShowMobileCart(true)}
                >
                    <ShoppingBag className="w-6 h-6" />
                    {cartItemCount > 0 && (
                        <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-white">
                            {cartItemCount}
                        </span>
                    )}
                </Button>
            </div>
        </div>
    )
}

function CategoryPill({ label, active, onClick }) {
    return (
        <button
            onClick={onClick}
            className={`
                px-5 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all border
                ${active
                    ? 'bg-gray-900 text-white border-gray-900 shadow-md'
                    : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:bg-gray-50'}
            `}
        >
            {label}
        </button>
    )
}
