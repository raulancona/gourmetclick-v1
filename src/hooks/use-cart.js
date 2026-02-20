import { useState, useCallback, useMemo, useEffect } from 'react'
import { toast } from 'sonner'

export function useCart() {
    const [cart, setCart] = useState([])
    const [editingOrder, setEditingOrder] = useState(null)

    // Additional fields state managed by the hook
    const [orderType, setOrderType] = useState('dine_in')
    const [paymentMethod, setPaymentMethod] = useState('cash')
    const [customerName, setCustomerName] = useState('')
    const [tableNumber, setTableNumber] = useState('')
    const [deliveryAddress, setDeliveryAddress] = useState('')
    const [notes, setNotes] = useState('')
    const [showMobileCart, setShowMobileCart] = useState(false)

    // Load edit mode order if exists
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

    const addToCart = useCallback((product, modifiers = []) => {
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
    }, [])

    // Add multiple items at once (e.g. from quantity modal)
    const addMultipleToCart = useCallback((product, modifiers = [], quantity = 1) => {
        for (let i = 0; i < quantity; i++) {
            addToCart(product, modifiers)
        }
    }, [addToCart])

    const removeFromCart = useCallback((productId) => {
        setCart(prev => prev.filter(item => item.id !== productId))
    }, [])

    const updateQuantity = useCallback((productId, delta) => {
        setCart(prev => prev.map(item => {
            if (item.id === productId) {
                const newQty = Math.max(1, item.quantity + delta)
                return { ...item, quantity: newQty }
            }
            return item
        }))
    }, [])

    const clearCart = useCallback(() => {
        setCart([])
        setCustomerName('')
        setTableNumber('')
        setDeliveryAddress('')
        setNotes('')
        setEditingOrder(null)
    }, [])

    const cartTotal = useMemo(() => cart.reduce((acc, item) => acc + (item.price * item.quantity), 0), [cart])
    const cartItemCount = useMemo(() => cart.reduce((acc, item) => acc + item.quantity, 0), [cart])

    return {
        cart,
        addToCart,
        addMultipleToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        cartTotal,
        cartItemCount,
        editingOrder,
        orderType, setOrderType,
        paymentMethod, setPaymentMethod,
        customerName, setCustomerName,
        tableNumber, setTableNumber,
        deliveryAddress, setDeliveryAddress,
        notes, setNotes,
        showMobileCart, setShowMobileCart
    }
}
