import { createContext, useContext, useState, useEffect } from 'react'

const CartContext = createContext()

export function useCart() {
    const context = useContext(CartContext)
    if (!context) {
        throw new Error('useCart must be used within CartProvider')
    }
    return context
}

export function CartProvider({ children }) {
    const [items, setItems] = useState([])

    // Load cart from localStorage on mount
    useEffect(() => {
        const savedCart = localStorage.getItem('gourmetclick_cart')
        if (savedCart) {
            try {
                setItems(JSON.parse(savedCart))
            } catch (error) {
                console.error('Error loading cart:', error)
            }
        }
    }, [])

    // Save cart to localStorage whenever it changes
    useEffect(() => {
        localStorage.setItem('gourmetclick_cart', JSON.stringify(items))
    }, [items])

    const areModifiersEqual = (m1, m2) => {
        if (!m1 && !m2) return true
        if (!m1 || !m2) return false
        if (m1.length !== m2.length) return false

        const sorted1 = [...m1].sort((a, b) => (a.name || '').localeCompare(b.name || ''))
        const sorted2 = [...m2].sort((a, b) => (a.name || '').localeCompare(b.name || ''))

        return sorted1.every((mod, index) => {
            const other = sorted2[index]
            return mod.name === other.name && mod.extra_price === other.extra_price && mod.value === other.value
        })
    }

    const addItem = (product, modifiers = [], quantity = 1) => {
        setItems(prev => {
            const existingIndex = prev.findIndex(item =>
                item.product.id === product.id &&
                areModifiersEqual(item.modifiers, modifiers)
            )

            if (existingIndex > -1) {
                return prev.map((item, idx) => {
                    if (idx === existingIndex) {
                        const newQuantity = item.quantity + quantity
                        return {
                            ...item,
                            quantity: newQuantity,
                            subtotal: calculateItemSubtotal(item.product, item.modifiers, newQuantity)
                        }
                    }
                    return item
                })
            }

            const newItem = {
                id: Date.now() + Math.random(),
                product,
                modifiers,
                quantity,
                subtotal: calculateItemSubtotal(product, modifiers, quantity)
            }
            return [...prev, newItem]
        })
    }

    const removeItem = (itemId) => {
        setItems(prev => prev.filter(item => item.id !== itemId))
    }

    const updateQuantity = (itemId, quantity) => {
        if (quantity <= 0) {
            removeItem(itemId)
            return
        }

        setItems(prev => prev.map(item => {
            if (item.id === itemId) {
                return {
                    ...item,
                    quantity,
                    subtotal: calculateItemSubtotal(item.product, item.modifiers, quantity)
                }
            }
            return item
        }))
    }

    const clearCart = () => {
        setItems([])
    }

    const calculateItemSubtotal = (product, modifiers, quantity) => {
        const basePrice = parseFloat(product.price)
        const modifiersTotal = modifiers.reduce((sum, mod) => {
            return sum + parseFloat(mod.extra_price || 0)
        }, 0)
        return (basePrice + modifiersTotal) * quantity
    }

    const getTotal = () => {
        return items.reduce((sum, item) => sum + item.subtotal, 0)
    }

    const getItemCount = () => {
        return items.reduce((sum, item) => sum + item.quantity, 0)
    }

    const value = {
        items,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        getTotal,
        getItemCount
    }

    return (
        <CartContext.Provider value={value}>
            {children}
        </CartContext.Provider>
    )
}
