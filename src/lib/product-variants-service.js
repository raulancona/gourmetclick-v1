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
            restaurant_id: restaurantId
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
    const baseFields = (v, idx) => ({
        product_id: productId,
        restaurant_id: restaurantId,
        name: v.name,
        price: parseFloat(v.price) || 0,
        costo: parseFloat(v.costo) || 0,
        sku: v.sku || null,
        is_available: v.is_available !== false,
        sort_order: idx
    })

    // Split new variants (no id) from existing ones (have id)
    const newVariants = variantsData.filter(v => !v.id).map((v, idx) => baseFields(v, idx))
    const existingVariants = variantsData.filter(v => !!v.id).map((v, idx) => ({
        id: v.id,
        ...baseFields(v, variantsData.indexOf(v))
    }))

    const results = []

    // INSERT new variants (no id sent — DB generates uuid)
    if (newVariants.length > 0) {
        const { data, error } = await supabase
            .from('product_variants')
            .insert(newVariants)
            .select()
        if (error) throw error
        results.push(...(data || []))
    }

    // UPSERT existing variants (id present — updates in place)
    if (existingVariants.length > 0) {
        const { data, error } = await supabase
            .from('product_variants')
            .upsert(existingVariants, { onConflict: 'id' })
            .select()
        if (error) throw error
        results.push(...(data || []))
    }

    return results
}
