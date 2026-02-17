import { supabase } from './supabase'

/**
 * Category Service
 * Handles all CRUD operations for menu categories
 */

/**
 * Fetch all categories for a user
 */
export async function getCategories(userId) {
    const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('user_id', userId)
        .order('sort_order', { ascending: true })

    if (error) throw error
    return data || []
}

/**
 * Create a new category
 */
export async function createCategory(categoryData, userId) {
    const { data, error } = await supabase
        .from('categories')
        .insert([{
            ...categoryData,
            user_id: userId
        }])
        .select()
        .single()

    if (error) throw error
    return data
}

/**
 * Update a category
 */
export async function updateCategory(categoryId, updates, userId) {
    const { data, error } = await supabase
        .from('categories')
        .update(updates)
        .eq('id', categoryId)
        .eq('user_id', userId)
        .select()
        .single()

    if (error) throw error
    return data
}

/**
 * Delete a category
 */
export async function deleteCategory(categoryId, userId) {
    const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', categoryId)
        .eq('user_id', userId)

    if (error) throw error
}

/**
 * Reorder categories
 */
export async function reorderCategories(categories, userId) {
    const updates = categories.map((cat, index) => ({
        id: cat.id,
        sort_order: index,
        user_id: userId,
        updated_at: new Date().toISOString()
    }))

    const { error } = await supabase
        .from('categories')
        .upsert(updates)

    if (error) throw error
}

/**
 * Get categories by restaurant slug (public access)
 */
export async function getCategoriesBySlug(slug) {
    // First get the user_id from the slug
    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('slug', slug)
        .single()

    if (profileError) throw profileError

    const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('user_id', profile.id)
        .order('sort_order', { ascending: true })

    if (error) throw error
    return data || []
}
