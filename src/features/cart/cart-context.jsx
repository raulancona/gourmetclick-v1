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

    const addItem = (product, modifiers = [], quantity = 1) => {
        const newItem = {
            id: Date.now() + Math.random(),
            product,
            modifiers,
            quantity,
            subtotal: calculateItemSubtotal(product, modifiers, quantity)
        }

        setItems(prev => [...prev, newItem])
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
