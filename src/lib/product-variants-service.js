import { supabase } from './supabase'

/**
 * Product Variants Service
 * Handles all CRUD operations for product variants (sizes/options)
 */

export async function getProductVariants(productId) {
    const { data, error } = await supabase
        .from('product_variants')
        .select('*')
        .eq('product_id', productId)
        .order('sort_order', { ascending: true })

    if (error) throw error
    return data || []
}

export async function createProductVariant(variantData, restaurantId) {
    const { data: { user } } = await supabase.auth.getUser()

    const { data, error } = await supabase
        .from('product_variants')
        .insert([{
            ...variantData,
            restaurant_id: restaurantId,
            user_id: user?.id || restaurantId
        }])
        .select()
        .single()

    if (error) throw error
    return data
}

export async function updateProductVariant(variantId, variantData) {
    const { data, error } = await supabase
        .from('product_variants')
        .update({
            ...variantData,
            updated_at: new Date().toISOString()
        })
        .eq('id', variantId)
        .select()
        .single()

    if (error) throw error
    return data
}

export async function deleteProductVariant(variantId) {
    const { error } = await supabase
        .from('product_variants')
        .delete()
        .eq('id', variantId)

    if (error) throw error
}

export async function bulkUpsertVariants(productId, variantsData, restaurantId) {
    const { data: { user } } = await supabase.auth.getUser()

    // Map variants ensuring they have product_id and restaurant_id
    const variantsToUpsert = variantsData.map((v, idx) => ({
        id: v.id || undefined, // undefined will let DB to generate uuid if new
        product_id: productId,
        restaurant_id: restaurantId,
        user_id: user?.id || restaurantId,
        name: v.name,
        price: v.price,
        costo: v.costo || 0,
        sku: v.sku || null,
        is_available: v.is_available !== false,
        sort_order: idx
    }))

    const { data, error } = await supabase
        .from('product_variants')
        .upsert(variantsToUpsert)
        .select()

    if (error) throw error
    return data || []
}
