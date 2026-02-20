import { useState } from 'react'
import { Search, Loader2 } from 'lucide-react'
import { useProducts } from '../hooks/use-products'
import { useCart } from '../hooks/use-cart'
import { useAuth } from '../features/auth/auth-context'
import { useTenant } from '../features/auth/tenant-context'
import { toast } from 'sonner'
import { useTerminal } from '../features/auth/terminal-context'
import { supabase } from '../lib/supabase'
import { createOrder, updateOrder } from '../lib/order-service'
import { formatCurrency } from '../lib/utils'
import { Button } from '../components/ui/button'

// Components
import { ProductGrid } from '../features/pos/components/product-grid'
import { CartPanel } from '../features/pos/components/cart-panel'
import { ModifierModal } from '../features/pos/components/modifier-modal'
import { CategorySelector } from '../features/pos/components/category-selector'
import { SuccessModal } from '../features/pos/components/success-modal'

export default function POSPage() {
    const { user } = useAuth()
    const { tenant } = useTenant()
    const { activeEmployee } = useTerminal()
    const {
        categories, loading,
        searchTerm, setSearchTerm,
        selectedCategory, setSelectedCategory,
        filteredProducts
    } = useProducts()

    const {
        cart, addToCart, addMultipleToCart, updateQuantity, clearCart,
        cartTotal, cartItemCount, editingOrder, setEditingOrder,
        orderType, setOrderType,
        paymentMethod, setPaymentMethod,
        customerName, setCustomerName,
        tableNumber, setTableNumber,
        deliveryAddress, setDeliveryAddress,
        notes, setNotes,
        showMobileCart, setShowMobileCart
    } = useCart()

    const [isSubmitting, setIsSubmitting] = useState(false)
    const [montoRecibido, setMontoRecibido] = useState('')

    // Modifier Modal State
    const [selectedProduct, setSelectedProduct] = useState(null)
    const [isOptionsModalOpen, setIsOptionsModalOpen] = useState(false)
    const [customizations, setCustomizations] = useState('')
    const [availableModifiers, setAvailableModifiers] = useState([])
    const [selectedModifiers, setSelectedModifiers] = useState([])
    const [fetchingModifiers, setFetchingModifiers] = useState(false)
    const [modalQuantity, setModalQuantity] = useState(1)

    // Success Modal State
    const [createdOrder, setCreatedOrder] = useState(null)
    const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false)

    const handleProductClick = async (product) => {
        if (product.has_extras) {
            setSelectedProduct(product)
            setCustomizations('')
            setSelectedModifiers([])
            setModalQuantity(1)
            setIsOptionsModalOpen(true)

            try {
                setFetchingModifiers(true)
                const { data: groups, error: groupError } = await supabase
                    .from('modifier_groups')
                    .select('id, name, min_selection')
                    .eq('product_id', product.id)

                if (groupError) throw groupError

                if (groups && groups.length > 0) {
                    const groupIds = groups.map(g => g.id)
                    const { data: options, error: optError } = await supabase
                        .from('modifier_options')
                        .select('id, name, extra_price, group_id')
                        .in('group_id', groupIds)

                    if (optError) throw optError

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

    const handleAddWithOptions = () => {
        const itemModifiers = [
            ...selectedModifiers.map(m => ({ name: m.name, extra_price: m.extra_price })),
            ...(customizations.trim() ? [{ name: 'Nota', value: customizations }] : [])
        ]

        const extraTotal = selectedModifiers.reduce((acc, m) => acc + parseFloat(m.extra_price), 0)

        // Add items according to quantity chosen in modal
        addMultipleToCart({
            ...selectedProduct,
            price: parseFloat(selectedProduct.price) + extraTotal
        }, itemModifiers, modalQuantity)

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
                user_id: user.id, // ID del propietario logueado en auth
                restaurant_id: tenant.id, // ID del tenant
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
                if (activeEmployee && activeEmployee.rol !== 'admin') {
                    toast.error('No tienes permisos para editar órdenes')
                    return
                }
                await updateOrder(editingOrder.id, orderData, tenant.id)
                toast.success('Orden actualizada correctamente')
            } else {
                const newOrder = await createOrder(orderData)
                console.log('Order created:', newOrder)
                setCreatedOrder(newOrder)
                setIsSuccessModalOpen(true)
            }

            clearCart()
            setMontoRecibido('')
        } catch (error) {
            console.error('Error al procesar la orden:', error)
            toast.error(error.message || 'Error al crear la orden')
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
            clearCart() // This resets all cart state including editingOrder
            toast.info('Modo edición cancelado')
        }
    }

    return (
        <div className="flex h-full bg-muted/30 overflow-hidden font-sans">
            {/* Main Product Area (Middle) */}
            <div className="flex-1 flex flex-col min-w-0 bg-background/50">
                {/* Header */}
                <div className="h-20 pl-16 pr-6 lg:px-6 flex items-center justify-between shrink-0">
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
                <CategorySelector
                    categories={categories}
                    selectedCategory={selectedCategory}
                    onSelectCategory={setSelectedCategory}
                />

                {/* Grid */}
                <div className="flex-1 overflow-y-auto px-6 pb-24 md:pb-6">
                    <ProductGrid
                        products={filteredProducts}
                        loading={loading}
                        onProductClick={handleProductClick}
                    />
                </div>
            </div>

            {/* Mobile Cart Trigger Button */}
            <div className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-20 w-[90%] max-w-sm">
                <Button
                    className="w-full h-14 rounded-full shadow-2xl flex items-center justify-between px-6 bg-primary text-primary-foreground hover:scale-[1.02] transition-transform"
                    onClick={() => setShowMobileCart(true)}
                >
                    <div className="flex items-center gap-3">
                        <div className="bg-white/20 px-2.5 py-1 rounded-full text-xs font-bold backdrop-blur-sm">
                            {cartItemCount}
                        </div>
                        <span className="font-semibold text-sm">Ver Orden</span>
                    </div>
                    <span className="font-bold text-lg tracking-tight">{formatCurrency(cartTotal)}</span>
                </Button>
            </div>

            {/* Cart Panel (Right) */}
            <CartPanel
                cart={cart}
                cartItemCount={cartItemCount}
                cartTotal={cartTotal}
                editingOrder={editingOrder}
                onCancelEdit={cancelEdit}
                onClearCart={clearCart}
                showMobileCart={showMobileCart}
                setShowMobileCart={setShowMobileCart}
                customerName={customerName}
                setCustomerName={setCustomerName}
                orderType={orderType}
                setOrderType={setOrderType}
                tableNumber={tableNumber}
                setTableNumber={setTableNumber}
                notes={notes}
                setNotes={setNotes}
                paymentMethod={paymentMethod}
                setPaymentMethod={setPaymentMethod}
                montoRecibido={montoRecibido}
                setMontoRecibido={setMontoRecibido}
                updateQuantity={updateQuantity}
                isSubmitting={isSubmitting}
                handleCreateOrder={handleCreateOrder}
            />

            {/* Product Options Modal */}
            <ModifierModal
                isOpen={isOptionsModalOpen}
                onClose={() => setIsOptionsModalOpen(false)}
                product={selectedProduct}
                fetchingModifiers={fetchingModifiers}
                availableModifiers={availableModifiers}
                selectedModifiers={selectedModifiers}
                onToggleModifier={toggleModifier}
                customizations={customizations}
                onCustomizationsChange={setCustomizations}
                quantity={modalQuantity}
                onQuantityChange={setModalQuantity}
                onAddToCart={handleAddWithOptions}
            />

            {/* Success Modal */}
            <SuccessModal
                isOpen={isSuccessModalOpen}
                onClose={() => setIsSuccessModalOpen(false)}
                createdOrder={createdOrder}
                onCopyTrackingLink={copyTrackingLink}
            />
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
