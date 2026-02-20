import { supabase } from './supabase'

/**
 * Product Service
 * Handles all CRUD operations for products with user ownership verification
 */

/**
 * Fetch all products for the authenticated user
 * @param {string} userId - The authenticated user's ID
 * @returns {Promise<Array>} Array of products
 */
export async function getProducts(userId, { page = 1, pageSize = 50 } = {}) {
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    const { data, error, count } = await supabase
        .from('products')
        .select('*', { count: 'exact' })
        .or(`restaurant_id.eq.${userId},user_id.eq.${userId}`)
        .eq('is_active', true) // Only fetch active products
        .order('created_at', { ascending: false })
        .range(from, to)

    if (error) throw error
    return { data: data || [], count }
}

/**
 * Fetch a single product by ID with ownership verification
 * @param {string} id - Product ID
 * @param {string} userId - The authenticated user's ID
 * @returns {Promise<Object>} Product object
 */
export async function getProductById(id, userId) {
    const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .or(`restaurant_id.eq.${userId},user_id.eq.${userId}`)
        .single()

    if (error) throw error
    return data
}

/**
 * Create a new product
 * @param {Object} productData - Product data (name, description, price, sku, image_url)
 * @param {string} userId - The authenticated user's ID
 * @returns {Promise<Object>} Created product
 */
export async function createProduct(productData, userId) {
    const { data, error } = await supabase
        .from('products')
        .insert([{
            ...productData,
            restaurant_id: userId,
            user_id: userId // Requerido por DB constraint
        }])
        .select()
        .single()

    if (error) throw error
    return data
}

/**
 * Update an existing product with ownership verification
 * @param {string} id - Product ID
 * @param {Object} productData - Updated product data
 * @param {string} userId - The authenticated user's ID
 * @returns {Promise<Object>} Updated product
 */
export async function updateProduct(id, productData, userId) {
    // First verify ownership
    await getProductById(id, userId)

    const { data, error } = await supabase
        .from('products')
        .update({
            ...productData,
            updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .or(`restaurant_id.eq.${userId},user_id.eq.${userId}`)
        .select()
        .single()

    if (error) throw error
    return data
}

/**
 * Delete a product with ownership verification
 * @param {string} id - Product ID
 * @param {string} userId - The authenticated user's ID
 * @returns {Promise<void>}
 */
export async function deleteProduct(id, userId) {
    // First verify ownership
    await getProductById(id, userId)

    const { error } = await supabase
        .from('products')
        .update({ is_active: false }) // Soft delete
        .eq('id', id)
        .or(`restaurant_id.eq.${userId},user_id.eq.${userId}`)

    if (error) throw error
}

/**
 * Bulk create products from CSV import
 * @param {Array} productsArray - Array of product objects
 * @param {string} userId - The authenticated user's ID
 * @returns {Promise<Array>} Array of created products
 */
export async function bulkCreateProducts(productsArray, userId) {
    const productsWithUserId = productsArray.map(product => ({
        ...product,
        restaurant_id: userId,
        user_id: userId // Requerido por DB constraint
    }))

    const { data, error } = await supabase
        .from('products')
        .insert(productsWithUserId)
        .select()

    if (error) throw error
    return data || []
}

/**
 * Get product count for the authenticated user
 * @param {string} userId - The authenticated user's ID
 * @returns {Promise<number>} Product count
 */
export async function getProductCount(userId) {
    const { count, error } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .or(`restaurant_id.eq.${userId},user_id.eq.${userId}`)

    if (error) throw error
    return count || 0
}
