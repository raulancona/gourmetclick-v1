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

    // Get categories
    const { data: categories, error: categoriesError } = await supabase
        .from('categories')
        .select('*')
        .eq('user_id', profile.id)
        .order('order_index', { ascending: true })

    if (categoriesError) throw categoriesError

    // Get products with modifiers
    const { data: products, error: productsError } = await supabase
        .from('products')
        .select(`
            *,
            modifier_groups (
                *,
                modifier_options (*)
            )
        `)
        .eq('user_id', profile.id)
        .eq('is_available', true)
        .order('created_at', { ascending: false })

    if (productsError) throw productsError

    return {
        restaurant: profile,
        categories: categories || [],
        products: products || []
    }
}
