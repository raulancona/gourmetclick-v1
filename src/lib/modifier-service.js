import { supabase } from './supabase'

/**
 * Modifier Service
 * Handles all operations for modifier groups and options
 */

/**
 * Get all modifier groups for a product
 */
export async function getModifierGroups(productId) {
    const { data, error } = await supabase
        .from('modifier_groups')
        .select(`
            *,
            modifier_options (*)
        `)
        .eq('product_id', productId)
        .order('created_at', { ascending: true })

    if (error) throw error
    return data || []
}

/**
 * Create a modifier group with options
 */
export async function createModifierGroup(groupData, productId) {
    const { options, ...groupFields } = groupData

    // Create the group
    const { data: group, error: groupError } = await supabase
        .from('modifier_groups')
        .insert([{
            ...groupFields,
            product_id: productId
        }])
        .select()
        .single()

    if (groupError) throw groupError

    // Create the options if provided
    if (options && options.length > 0) {
        const optionsToInsert = options.map(opt => ({
            ...opt,
            group_id: group.id
        }))

        const { error: optionsError } = await supabase
            .from('modifier_options')
            .insert(optionsToInsert)

        if (optionsError) throw optionsError
    }

    return group
}

/**
 * Update a modifier group
 */
export async function updateModifierGroup(id, groupData) {
    const { data, error } = await supabase
        .from('modifier_groups')
        .update({
            ...groupData,
            updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single()

    if (error) throw error
    return data
}

/**
 * Delete a modifier group (cascade deletes options)
 */
export async function deleteModifierGroup(id) {
    const { error } = await supabase
        .from('modifier_groups')
        .delete()
        .eq('id', id)

    if (error) throw error
}

/**
 * Create a modifier option
 */
export async function createModifierOption(optionData, groupId) {
    const { data, error } = await supabase
        .from('modifier_options')
        .insert([{
            ...optionData,
            group_id: groupId
        }])
        .select()
        .single()

    if (error) throw error
    return data
}

/**
 * Update a modifier option
 */
export async function updateModifierOption(id, optionData) {
    const { data, error } = await supabase
        .from('modifier_options')
        .update({
            ...optionData,
            updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single()

    if (error) throw error
    return data
}

/**
 * Delete a modifier option
 */
export async function deleteModifierOption(id) {
    const { error } = await supabase
        .from('modifier_options')
        .delete()
        .eq('id', id)

    if (error) throw error
}

/**
 * Get modifiers by product slug (public access)
 */
export async function getModifiersByProductId(productId) {
    const { data, error } = await supabase
        .from('modifier_groups')
        .select(`
            *,
            modifier_options (*)
        `)
        .eq('product_id', productId)

    if (error) throw error
    return data || []
}
