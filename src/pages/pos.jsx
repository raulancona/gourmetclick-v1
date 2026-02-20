import { useState, useEffect, useRef } from 'react'
import {
    Search, ShoppingBag, Trash2, Plus, Minus, UtensilsCrossed,
    Truck, Armchair, Store, CreditCard, Banknote, Landmark,
    ChevronRight, Loader2, ArrowLeft, Package, Copy, Check, CheckCircle2
} from 'lucide-react'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Textarea } from '../components/ui/textarea'
import { getProducts } from '../lib/product-service'
import { getCategories } from '../lib/category-service'
import { createOrder, updateOrder } from '../lib/order-service'
import { toast } from 'sonner'
import { formatCurrency } from '../lib/utils'
import { useAuth } from '../features/auth/auth-context'
import { supabase } from '../lib/supabase'
import { useCategorySubscription } from '../hooks/use-category-subscription'
import { Modal, ModalFooter } from '../components/ui/modal'
import { useTerminal } from '../features/auth/terminal-context'
import { useQueryClient } from '@tanstack/react-query'

export default function POSPage() {
    const { user } = useAuth()
    const { activeEmployee } = useTerminal()
    const isMesero = activeEmployee?.rol === 'mesero'
    const queryClient = useQueryClient()
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
    const [montoRecibido, setMontoRecibido] = useState('')

    const [editingOrder, setEditingOrder] = useState(null)
    const [selectedProduct, setSelectedProduct] = useState(null)
    const [isOptionsModalOpen, setIsOptionsModalOpen] = useState(false)
    const [customizations, setCustomizations] = useState('')
    const [createdOrder, setCreatedOrder] = useState(null)
    const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false)
    const [availableModifiers, setAvailableModifiers] = useState([])
    const [selectedModifiers, setSelectedModifiers] = useState([])
    const [fetchingModifiers, setFetchingModifiers] = useState(false)
    const [modalQuantity, setModalQuantity] = useState(1)

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

    // Products Realtime Subscription
    useEffect(() => {
        if (!user?.id) return

        // Unique channel name per user prevents collisions when
        // cashier & waiter both have the POS open simultaneously.
        const channel = supabase
            .channel(`products-realtime-${user.id}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'products',
                    filter: `user_id=eq.${user.id}`
                },
                () => {
                    loadData()
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [user?.id])

    const filteredProducts = products.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase())
        const matchesCategory = selectedCategory === 'all' || p.category_id === selectedCategory
        return matchesSearch && matchesCategory
    })

    const handleProductClick = async (product) => {
        if (product.has_extras) {
            setSelectedProduct(product)
            setCustomizations('')
            setSelectedModifiers([])
            setModalQuantity(1) // Reset quantity on each modal open
            setIsOptionsModalOpen(true)

            try {
                setFetchingModifiers(true)
                const { data: groups, error: groupError } = await supabase
                    .from('modifier_groups')
                    .select('id, name, min_selection')
                    .eq('product_id', product.id)

                if (groupError) throw groupError

                if (groups && groups.length > 0) {
                    // ✅ FIX: Fetch modifiers from ALL groups, not just groups[0]
                    const groupIds = groups.map(g => g.id)
                    const { data: options, error: optError } = await supabase
                        .from('modifier_options')
                        .select('id, name, extra_price, group_id')
                        .in('group_id', groupIds)

                    if (optError) throw optError

                    // Attach group info to each option for display
                    const optionsWithGroup = (options || []).map(opt => ({
                        ...opt,
                        groupName: groups.find(g => g.id === opt.group_id)?.name || 'Extras'
                    }))
                    setAvailableModifiers(optionsWithGroup)
                } else {
                    setAvailableModifiers([])
                }
            } catch (err) {
                console.error('Error fetching modifiers:', err)
                toast.error('No se pudieron cargar los extras')
            } finally {
                setFetchingModifiers(false)
            }
        } else {
            addToCart(product)
        }
    }

    const addToCart = (product, modifiers = []) => {
        setCart(prev => {
            // For products with extras, we might want to treat them as unique entries even if it's the same product
            // but with different customizations.
            if (product.has_extras) {
                return [...prev, { ...product, product_id: product.id, quantity: 1, modifiers, id: `${product.id}-${Date.now()}` }]
            }

            const existing = prev.find(item => item.id === product.id)
            if (existing) {
                return prev.map(item =>
                    item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
                )
            }
            return [...prev, { ...product, product_id: product.id, quantity: 1, modifiers: [] }]
        })
    }

    const handleAddWithOptions = () => {
        const itemModifiers = [
            ...selectedModifiers.map(m => ({ name: m.name, extra_price: m.extra_price })),
            ...(customizations.trim() ? [{ name: 'Nota', value: customizations }] : [])
        ]

        const extraTotal = selectedModifiers.reduce((acc, m) => acc + parseFloat(m.extra_price), 0)

        // Add items according to quantity chosen in modal
        for (let i = 0; i < modalQuantity; i++) {
            addToCart({
                ...selectedProduct,
                price: parseFloat(selectedProduct.price) + extraTotal
            }, itemModifiers)
        }

        setIsOptionsModalOpen(false)
        setSelectedProduct(null)
        setCustomizations('')
        setSelectedModifiers([])
        setAvailableModifiers([])
        setModalQuantity(1)
    }

    const toggleModifier = (modifier) => {
        setSelectedModifiers(prev =>
            prev.find(m => m.id === modifier.id)
                ? prev.filter(m => m.id !== modifier.id)
                : [...prev, modifier]
        )
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
                status: editingOrder ? editingOrder.status : 'pending', // Default to pending for kitchen flow
                total: cartTotal,
                items: cart.map(item => ({
                    id: item.id, // Cart Item ID
                    product_id: item.product_id || item.id, // Original Product ID (fallback for legacy items)
                    name: item.name,
                    price: item.price,
                    unit_price: item.price, // Snapshot price
                    image_url: item.image_url,
                    quantity: item.quantity,
                    modifiers: item.modifiers,
                    subtotal: item.price * item.quantity
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
                const newOrder = await createOrder(orderData)
                setCreatedOrder(newOrder)
                setIsSuccessModalOpen(true)
                toast.success('Orden procesada correctamente')
            }

            setCart([])
            setCustomerName('')
            setTableNumber('')
            setDeliveryAddress('')
            setNotes('')
            setMontoRecibido('')
            setShowMobileCart(false)
        } catch (error) {
            console.error(error)
            toast.error('Error al procesar la orden')
        } finally {
            setIsSubmitting(false)
        }
    }

    const copyTrackingLink = () => {
        if (!createdOrder) return
        const link = `${window.location.origin}/rastreo/${createdOrder.tracking_id}`
        navigator.clipboard.writeText(link)
        toast.success('Link de rastreo copiado al portapapeles')
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
        <div className="flex h-full bg-muted/30 overflow-hidden font-sans">
            {/* Sidebar is now handled by DashboardLayout */}

            {/* 2. Main Product Area (Middle) */}
            <div className="flex-1 flex flex-col min-w-0 bg-background/50">
                {/* Header */}
                <div className="h-20 px-6 flex items-center justify-between shrink-0">
                    <div>
                        <h1 className="text-xl font-bold text-foreground">
                            {editingOrder ? `Editando Orden #${editingOrder.id.slice(0, 6)}` : 'Punto de Venta'}
                        </h1>
                        <p className="text-xs text-muted-foreground">{new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                    </div>
                    <div className="relative w-64 lg:w-80">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            className="w-full h-10 pl-10 pr-4 rounded-full border-none bg-card shadow-sm text-sm focus:ring-2 focus:ring-primary/20 outline-none text-foreground placeholder:text-muted-foreground"
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
                            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                            {filteredProducts.map(product => (
                                <div
                                    key={product.id}
                                    onClick={() => handleProductClick(product)}
                                    className="group bg-card rounded-2xl p-3 shadow-sm border border-transparent hover:border-primary/20 hover:shadow-md transition-all cursor-pointer flex flex-col"
                                >
                                    <div className="aspect-square rounded-xl bg-muted mb-3 overflow-hidden">
                                        {product.image_url ? (
                                            <img src={product.image_url} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-muted-foreground/50">
                                                <Package className="w-8 h-8" />
                                            </div>
                                        )}
                                    </div>
                                    <h3 className="font-semibold text-foreground text-sm mb-1 leading-snug line-clamp-2">{product.name}</h3>
                                    <div className="mt-auto flex items-center justify-between">
                                        <span className="font-bold text-foreground">{formatCurrency(product.price)}</span>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                handleProductClick(product)
                                            }}
                                            className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-muted-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-colors"
                                        >
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
                fixed inset-y-0 right-0 w-full sm:w-[400px] bg-card shadow-2xl transform transition-transform duration-300 z-30 flex flex-col
                ${showMobileCart ? 'translate-x-0' : 'translate-x-full lg:static lg:translate-x-0 lg:shadow-none lg:border-l lg:border-border'}
            `}>
                {/* Cart Header */}
                <div className="p-6 pb-4 shrink-0 bg-card z-10">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <h2 className="text-xl font-bold text-foreground">Orden Actual</h2>
                            <span className="bg-primary/10 text-primary text-xs font-bold px-2.5 py-1 rounded-full">{cartItemCount} Items</span>
                        </div>
                        <div className="flex items-center gap-2">
                            {/* Clear Cart / Cancel Edit */}
                            {(cart.length > 0 || editingOrder) && (
                                <button
                                    onClick={() => editingOrder ? cancelEdit() : (confirm('¿Vaciar carrito?') && setCart([]))}
                                    className={`p-2 rounded-lg transition-colors ${editingOrder ? 'text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20' : 'text-muted-foreground hover:text-destructive hover:bg-destructive/10'}`}
                                    title={editingOrder ? "Cancelar Edición" : "Vaciar carrito"}
                                >
                                    {editingOrder ? <Trash2 className="w-5 h-5" /> : <Trash2 className="w-5 h-5" />}
                                </button>
                            )}
                            {/* Mobile Close Button */}
                            <button
                                onClick={() => setShowMobileCart(false)}
                                className="lg:hidden p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
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
                            className="bg-muted/50 border-transparent focus:bg-card transition-all rounded-xl"
                        />
                    </div>

                    {/* User / Settings Mini Bar */}
                    <div className="bg-muted/50 rounded-xl p-1.5 flex gap-2">
                        <button
                            onClick={() => setOrderType('dine_in')}
                            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${orderType === 'dine_in' ? 'bg-card shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            Mesa
                        </button>
                        <button
                            onClick={() => setOrderType('pickup')}
                            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${orderType === 'pickup' ? 'bg-card shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            Llevar
                        </button>
                        <button
                            onClick={() => setOrderType('delivery')}
                            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${orderType === 'delivery' ? 'bg-card shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            Envío
                        </button>
                    </div>
                </div>

                {/* Cart Items */}
                <div className="flex-1 overflow-y-auto px-6 space-y-4 min-h-0">
                    {cart.map(item => (
                        <div key={item.id} className="flex gap-3">
                            <div className="w-14 h-14 rounded-lg bg-muted overflow-hidden shrink-0">
                                {item.image_url && <img src={item.image_url} className="w-full h-full object-cover" />}
                            </div>
                            <div className="flex-1 min-w-0 flex flex-col justify-center">
                                <h4 className="font-semibold text-sm text-foreground truncate">{item.name}</h4>
                                {item.modifiers && item.modifiers.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-1">
                                        {item.modifiers.map((mod, i) => (
                                            <span key={i} className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-primary/10 text-primary">
                                                {mod.name}
                                            </span>
                                        ))}
                                    </div>
                                )}
                                <p className="text-xs text-muted-foreground mt-0.5">{formatCurrency(item.price)}</p>
                            </div>
                            <div className="flex flex-col items-end justify-center gap-1">
                                <span className="font-bold text-sm text-foreground">{formatCurrency(item.price * item.quantity)}</span>
                                <div className="flex items-center gap-2 bg-muted/50 rounded-lg p-0.5">
                                    <button onClick={() => updateQuantity(item.id, -1)} className="w-5 h-5 flex items-center justify-center text-muted-foreground hover:bg-card hover:shadow-sm rounded-md transition-all"><Minus className="w-3 h-3" /></button>
                                    <span className="text-xs font-bold w-4 text-center text-foreground">{item.quantity}</span>
                                    <button onClick={() => updateQuantity(item.id, 1)} className="w-5 h-5 flex items-center justify-center text-muted-foreground hover:bg-card hover:shadow-sm rounded-md transition-all"><Plus className="w-3 h-3" /></button>
                                </div>
                            </div>
                        </div>
                    ))}

                    {cart.length === 0 && (
                        <div className="h-40 flex flex-col items-center justify-center text-muted-foreground/50 border-2 border-dashed border-border rounded-xl my-4">
                            <ShoppingBag className="w-8 h-8 mb-2 opacity-50" />
                            <p className="text-sm">Carrito vacío</p>
                        </div>
                    )}
                </div>

                {/* Footer / Checkout */}
                <div className="p-6 bg-card border-t border-border shrink-0 space-y-4">
                    {/* Inputs specific to order type */}
                    {orderType === 'dine_in' && (
                        <div className="flex items-center gap-3 bg-muted/50 p-2 rounded-xl">
                            <div className="w-8 h-8 rounded-lg bg-card flex items-center justify-center text-muted-foreground"><Armchair className="w-4 h-4" /></div>
                            <Input
                                placeholder="Número de Mesa"
                                value={tableNumber}
                                onChange={e => setTableNumber(e.target.value)}
                                className="border-none bg-transparent h-8 focus-visible:ring-0 placeholder:text-muted-foreground font-medium text-foreground"
                            />
                        </div>
                    )}

                    {/* Notes Input */}
                    <div className="pt-2">
                        <Textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Notas de la orden (opcional)..."
                            className="min-h-[60px] text-xs bg-muted/50 border-none resize-none focus:ring-1 focus:ring-primary/20 placeholder:text-muted-foreground"
                        />
                    </div>

                    {/* Payment Method Selector */}
                    <div className="space-y-2">
                        <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Método de Pago</Label>
                        <div className="grid grid-cols-3 gap-2">
                            {[
                                { id: 'cash', label: 'Efectivo', icon: Banknote },
                                { id: 'card', label: 'Tarjeta', icon: CreditCard },
                                { id: 'transfer', label: 'Transf.', icon: Landmark },
                            ].map((method) => (
                                <button
                                    key={method.id}
                                    onClick={() => setPaymentMethod(method.id)}
                                    className={`flex flex-col items-center justify-center p-2 rounded-xl border-2 transition-all gap-1 ${paymentMethod === method.id
                                        ? 'border-primary bg-primary/5 text-primary'
                                        : 'border-transparent bg-muted/50 text-muted-foreground hover:bg-muted'
                                        }`}
                                >
                                    <method.icon className="w-4 h-4" />
                                    <span className="text-[10px] font-bold">{method.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Cash Calculation UI */}
                    {paymentMethod === 'cash' && (
                        <div className="grid grid-cols-2 gap-3 pt-2">
                            <div className="space-y-1.5">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Monto Recibido</Label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                                    <Input
                                        type="number"
                                        placeholder="0.00"
                                        value={montoRecibido}
                                        onChange={(e) => setMontoRecibido(e.target.value)}
                                        className="pl-6 bg-muted/30 border-none rounded-xl h-10 font-bold"
                                    />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Cambio</Label>
                                <div className="h-10 px-3 flex items-center bg-primary/5 text-primary font-black rounded-xl border border-primary/20">
                                    {montoRecibido && parseFloat(montoRecibido) >= cartTotal
                                        ? formatCurrency(parseFloat(montoRecibido) - cartTotal)
                                        : '$0.00'
                                    }
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Totals */}
                    <div className="space-y-2 py-2">
                        <div className="flex justify-between text-sm text-muted-foreground">
                            <span>Subtotal</span>
                            <span>{formatCurrency(cartTotal)}</span>
                        </div>
                        <div className="flex justify-between text-base font-black text-foreground pt-2 border-t border-border">
                            <span>Total</span>
                            <span>{formatCurrency(cartTotal)}</span>
                        </div>
                    </div>

                    {/* Pay Button — prominent on both mobile and desktop */}
                    <Button
                        className="w-full h-14 rounded-xl font-black text-base tracking-wide shadow-xl shadow-primary/30 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground transition-all"
                        onClick={handleCreateOrder}
                        disabled={
                            cart.length === 0 ||
                            isSubmitting ||
                            (paymentMethod === 'cash' && (!montoRecibido || parseFloat(montoRecibido) < cartTotal))
                        }
                    >
                        {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                            <div className="flex items-center justify-between w-full px-2">
                                <span>{editingOrder ? '✏️ Actualizar Orden' : '✅ Procesar Venta'}</span>
                                <span className="font-black">{formatCurrency(cartTotal)}</span>
                            </div>
                        )}
                    </Button>
                </div>
            </div>

            {/* Mobile Toggle Button */}
            <div className={`fixed bottom-4 right-4 lg:hidden z-40 transition-transform duration-300 ${showMobileCart ? 'translate-x-[200%] opacity-0' : 'translate-x-0 opacity-100'}`}>
                <Button
                    className="h-14 w-14 rounded-full shadow-2xl bg-primary text-primary-foreground flex items-center justify-center relative"
                    onClick={() => setShowMobileCart(true)}
                >
                    <ShoppingBag className="w-6 h-6" />
                    {cartItemCount > 0 && (
                        <span className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-background">
                            {cartItemCount}
                        </span>
                    )}
                </Button>
            </div>
            {/* Product Options Modal */}
            <Modal
                isOpen={isOptionsModalOpen}
                onClose={() => setIsOptionsModalOpen(false)}
                title={`Opciones: ${selectedProduct?.name}`}
            >
                <div className="space-y-5">
                    {fetchingModifiers ? (
                        <div className="py-8 flex flex-col items-center justify-center gap-3">
                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                            <p className="text-sm text-muted-foreground">Cargando opciones...</p>
                        </div>
                    ) : (
                        <>
                            {availableModifiers.length > 0 ? (() => {
                                // Group modifiers by their groupName
                                const groups = availableModifiers.reduce((acc, mod) => {
                                    const key = mod.groupName || 'Extras'
                                    if (!acc[key]) acc[key] = []
                                    acc[key].push(mod)
                                    return acc
                                }, {})

                                return Object.entries(groups).map(([groupName, mods]) => (
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
                                                        onClick={() => toggleModifier(mod)}
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
                            })() : (
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
                                    onChange={(e) => setCustomizations(e.target.value)}
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
                                onClick={() => setModalQuantity(q => Math.max(1, q - 1))}
                                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-card transition-colors text-foreground"
                            >
                                <Minus className="w-4 h-4" />
                            </button>
                            <span className="w-8 text-center font-black text-foreground">{modalQuantity}</span>
                            <button
                                onClick={() => setModalQuantity(q => q + 1)}
                                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-card transition-colors text-foreground"
                            >
                                <Plus className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                    <Button variant="ghost" onClick={() => setIsOptionsModalOpen(false)} className="rounded-xl">
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleAddWithOptions}
                        className="rounded-xl px-8"
                        disabled={fetchingModifiers}
                    >
                        Agregar {modalQuantity > 1 ? `${modalQuantity}x ` : ''}por {formatCurrency(
                            (parseFloat(selectedProduct?.price || 0) +
                                selectedModifiers.reduce((acc, m) => acc + parseFloat(m.extra_price), 0)) * modalQuantity
                        )}
                    </Button>
                </ModalFooter>
            </Modal>

            {/* Success Modal */}
            <Modal
                isOpen={isSuccessModalOpen}
                onClose={() => setIsSuccessModalOpen(false)}
                title="¡Venta Exitosa!"
            >
                <div className="space-y-6 text-center py-4">
                    <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center mx-auto mb-4">
                        <CheckCircle2 className="w-10 h-10" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-foreground mb-2">Orden Procesada</h3>
                        <p className="text-muted-foreground text-sm">El pedido se ha regitrado correctamente. Comparte el link de rastreo con tu cliente:</p>
                    </div>

                    <div className="flex items-center gap-2 bg-muted p-3 rounded-xl border border-border">
                        <input
                            readOnly
                            className="bg-transparent border-none text-xs flex-1 outline-none font-mono text-muted-foreground"
                            value={`${window.location.origin}/rastreo/${createdOrder?.tracking_id}`}
                        />
                        <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            onClick={copyTrackingLink}
                        >
                            <Copy className="w-4 h-4" />
                        </Button>
                    </div>

                    <div className="pt-4">
                        <Button className="w-full" onClick={() => setIsSuccessModalOpen(false)}>
                            Entendido
                        </Button>
                    </div>
                </div>
            </Modal>
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
                    ? 'bg-primary text-primary-foreground border-primary shadow-md'
                    : 'bg-card text-muted-foreground border-border hover:border-primary/50 hover:bg-muted'}
            `}
        >
            {label}
        </button>
    )
}
