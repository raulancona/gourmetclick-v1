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

    const areModifiersEqual = (m1, m2) => {
        if (!m1 && !m2) return true
        if (!m1 || !m2) return false
        if (m1.length !== m2.length) return false

        // Sort both arrays to ensure order doesn't matter (though usually they are added in order)
        const sorted1 = [...m1].sort((a, b) => (a.name || '').localeCompare(b.name || ''))
        const sorted2 = [...m2].sort((a, b) => (a.name || '').localeCompare(b.name || ''))

        return sorted1.every((mod, index) => {
            const other = sorted2[index]
            return mod.name === other.name && mod.extra_price === other.extra_price && mod.value === other.value
        })
    }

    const addToCart = useCallback((product, modifiers = [], quantity = 1) => {
        setCart(prev => {
            // Find an existing item that matches product_id, modifiers AND current price
            // We use item.product_id || item.id to support legacy and new structure
            const existingIndex = prev.findIndex(item =>
                (item.product_id === product.id || item.id === product.id) &&
                areModifiersEqual(item.modifiers, modifiers) &&
                parseFloat(item.price) === parseFloat(product.price)
            )

            if (existingIndex > -1) {
                return prev.map((item, idx) =>
                    idx === existingIndex ? { ...item, quantity: item.quantity + quantity } : item
                )
            }

            // New item
            const newItem = {
                ...product,
                id: `${product.id}-${Date.now()}-${Math.random()}`, // Unique ID for this specific customization group
                product_id: product.id,
                quantity,
                modifiers
            }
            return [...prev, newItem]
        })
    }, [])

    // Add multiple items at once
    const addMultipleToCart = useCallback((product, modifiers = [], quantity = 1) => {
        addToCart(product, modifiers, quantity)
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
