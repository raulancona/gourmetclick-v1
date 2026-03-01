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
        .or(`user_id.eq.${userId},restaurant_id.eq.${userId}`)
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
            restaurant_id: categoryData.restaurant_id || userId // Fallback al owner ID
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
    // Si la actualización incluye cambios en los ownerships, los mantenemos
    const { data, error } = await supabase
        .from('categories')
        .update(updates)
        .eq('id', categoryId)
        // Se puede actualizar si coincide el user_id o el restaurant_id (pero por seguridad el RLS lo maneja)
        // Eliminamos .eq('user_id', userId) porque RLS ya protege y permite dualidad
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
    // Nuevamente delegamos permisos a RLS para evitar bloquear a empleados del mismo tenant

    if (error) throw error
}

/**
 * Reorder categories
 */
export async function reorderCategories(categories, userId) {
    const updates = categories.map((cat, index) => ({
        id: cat.id,
        name: cat.name, // Required for upsert to work with non-null constraint
        sort_order: index,
        restaurant_id: cat.restaurant_id || userId,
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
