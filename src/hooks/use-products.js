import { useState, useEffect, useMemo } from 'react'
import { getProducts } from '../lib/product-service'
import { getCategories } from '../lib/category-service'
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'
import { useRealtimeSubscription } from '../features/realtime/realtime-context'
import { useTenant } from '../features/auth/tenant-context'
import { useTerminal } from '../features/auth/terminal-context'

export function useProducts() {
    const { tenant } = useTenant()
    const { activeEmployee } = useTerminal()
    const restaurantId = tenant?.id || activeEmployee?.restaurante_id
    const ownerId = tenant?.ownerId || activeEmployee?.owner_id
    
    const [products, setProducts] = useState([])
    const [categories, setCategories] = useState([])
    const [loading, setLoading] = useState(true)

    // Sorting / Filtering state
    const [searchTerm, setSearchTerm] = useState('')
    const [selectedCategory, setSelectedCategory] = useState('all')

    const loadData = async () => {
        if (!restaurantId) return
        try {
            setLoading(true)
            const [productsResponse, cats] = await Promise.all([
                getProducts(restaurantId, { pageSize: 1000, ownerId }),
                getCategories(restaurantId, ownerId)
            ])
            setProducts(productsResponse.data)
            setCategories(cats)
        } catch (error) {
            console.error('Error loading POS data:', error)
            toast.error('Error al cargar productos')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadData()
    }, [restaurantId, ownerId])

    // Products Realtime Subscription
    useRealtimeSubscription('products', () => {
        console.log('🔄 Products changed, reloading...')
        loadData()
    })

    // Categories Realtime Subscription
    useRealtimeSubscription('categories', () => {
        console.log('🔄 Categories changed, reloading...')
        loadData()
    })

    const filteredProducts = useMemo(() => {
        return products.filter(p => {
            const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase())
            const matchesCategory = selectedCategory === 'all' || p.category_id === selectedCategory
            return matchesSearch && matchesCategory
        })
    }, [products, searchTerm, selectedCategory])

    return {
        products,
        categories,
        loading,
        searchTerm, setSearchTerm,
        selectedCategory, setSelectedCategory,
        filteredProducts,
        refreshProducts: loadData
    }
}
