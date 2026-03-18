import { supabase } from './supabase'

/**
 * Restaurant Service
 * Handles restaurant profile and public menu operations
 */

/**
 * Get restaurant profile by slug (public access)
 */
export async function getRestaurantBySlug(slug) {
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('slug', slug)
        .single()

    if (error) throw error
    return data
}

/**
 * Update restaurant settings
 */
export async function updateRestaurantSettings(userId, settings) {
    const { data, error } = await supabase
        .from('profiles')
        .update({
            ...settings,
            updated_at: new Date().toISOString()
        })
        .eq('id', userId)
        .select()
        .single()

    if (error) throw error
    return data
}

/**
 * Check if slug is available
 */
export async function isSlugAvailable(slug, currentUserId = null) {
    let query = supabase
        .from('profiles')
        .select('id')
        .eq('slug', slug)

    if (currentUserId) {
        query = query.neq('id', currentUserId)
    }

    const { data, error } = await query

    if (error) throw error
    return data.length === 0
}

/**
 * Get menu items by restaurant slug (public access)
 */
export async function getMenuBySlug(slug) {
    // Get restaurant profile
    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('slug', slug)
        .single()

    if (profileError) throw profileError

    // Get the actual restaurants.id (required for FK on orders.restaurant_id)
    const { data: restaurantRecord } = await supabase
        .from('restaurants')
        .select('id, facebook_url, instagram_url, whatsapp_number, config')
        .eq('owner_id', profile.id)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()

    // Build OR query to include both profile ID and the actual restaurant ID
    const orQuery = `restaurant_id.eq.${profile.id},user_id.eq.${profile.id}${restaurantRecord?.id ? `,restaurant_id.eq.${restaurantRecord.id}` : ''}`

    // Get categories
    const { data: categories, error: categoriesError } = await supabase
        .from('categories')
        .select('*')
        .or(orQuery)
        .order('sort_order', { ascending: true })

    if (categoriesError) throw categoriesError

    // Get products with variants and global modifiers
    const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select(`
            *,
            product_variants (*),
            product_modifier_groups (
                modifier_groups (
                    *,
                    modifier_options (*)
                )
            )
        `)
        .or(orQuery)
        .eq('is_active', true)
        .eq('is_available', true)
        .order('created_at', { ascending: false })

    if (productsError) throw productsError

    // Map the products to extract modifier_groups from the junction table
    const products = productsData.map(product => {
        const groups = product.product_modifier_groups?.map(pmg => pmg.modifier_groups).filter(Boolean) || []
        const variants = product.product_variants?.filter(v => v.is_available) || []
        return { ...product, modifier_groups: groups, product_variants: variants }
    })

    // Filter categories: only show categories that have at least one active+available product
    const productCategoryIds = new Set(products.map(p => p.category_id).filter(Boolean))
    const visibleCategories = (categories || []).filter(cat => productCategoryIds.has(cat.id))

    return {
        restaurant: {
            ...profile,
            restaurant_table_id: restaurantRecord?.id || null,
            facebook_url: restaurantRecord?.facebook_url || profile.facebook_url || null,
            instagram_url: restaurantRecord?.instagram_url || profile.instagram_url || null,
            whatsapp_number: restaurantRecord?.whatsapp_number || profile.whatsapp_number || profile.phone || null,
            config: restaurantRecord?.config || profile.config || {}
        },
        categories: visibleCategories,
        products: products || []
    }
}

