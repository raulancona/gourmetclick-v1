import { useState, useEffect, useMemo } from 'react'
import { getProducts } from '../lib/product-service'
import { getCategories } from '../lib/category-service'
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'
import { useRealtimeSubscription } from '../features/realtime/realtime-context'
import { useTenant } from '../features/auth/tenant-context'

export function useProducts() {
    const { tenant } = useTenant()
    const [products, setProducts] = useState([])
    const [categories, setCategories] = useState([])
    const [loading, setLoading] = useState(true)

    // Sorting / Filtering state
    const [searchTerm, setSearchTerm] = useState('')
    const [selectedCategory, setSelectedCategory] = useState('all')

    const loadData = async () => {
        if (!tenant?.id) return
        try {
            setLoading(true)
            const [productsResponse, cats] = await Promise.all([
                getProducts(tenant.id, { pageSize: 1000 }), // Fetch all/large batch for POS for now, or implement pagination in POS later
                getCategories(tenant.id)
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
    }, [tenant?.id])

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
