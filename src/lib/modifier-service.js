import { supabase } from './supabase'

/**
 * Modifier Service
 * Handles all operations for modifier groups and options
 */

/**
 * Get all modifier groups for a restaurant (Global Modifiers)
 */
export async function getGlobalModifierGroups(restaurantId) {
    const { data, error } = await supabase
        .from('modifier_groups')
        .select(`
            *,
            modifier_options (*)
        `)
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: true })

    if (error) throw error
    return data || []
}

/**
 * Get linked modifier groups for a product
 */
export async function getLinkedModifierGroups(productId) {
    const { data, error } = await supabase
        .from('product_modifier_groups')
        .select(`
            sort_order,
            modifier_groups (*, modifier_options (*))
        `)
        .eq('product_id', productId)
        .order('sort_order', { ascending: true })

    if (error) throw error
    // Flatten the result to match the old format
    return data?.map(d => ({ ...d.modifier_groups, link_sort_order: d.sort_order })) || []
}

/**
 * Create a modifier group with options (Global by default)
 */
export async function createModifierGroup(groupData, restaurantId) {
    const { options, ...groupFields } = groupData
    const { data: { user } } = await supabase.auth.getUser()

    // Create the group
    const { data: group, error: groupError } = await supabase
        .from('modifier_groups')
        .insert([{
            ...groupFields,
            restaurant_id: restaurantId,
            user_id: user?.id || restaurantId
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
 * Link a global modifier group to a product
 */
export async function linkModifierGroupToProduct(modifierGroupId, productId, sortOrder = 0) {
    const { error } = await supabase
        .from('product_modifier_groups')
        .insert([{
            modifier_group_id: modifierGroupId,
            product_id: productId,
            sort_order: sortOrder
        }])

    if (error) throw error
}

/**
 * Unlink a global modifier group from a product
 */
export async function unlinkModifierGroupFromProduct(modifierGroupId, productId) {
    const { error } = await supabase
        .from('product_modifier_groups')
        .delete()
        .eq('modifier_group_id', modifierGroupId)
        .eq('product_id', productId)

    if (error) throw error
}

/**
 * Get modifiers by product slug (public access)
 */
export async function getModifiersByProductId(productId) {
    const { data, error } = await supabase
        .from('product_modifier_groups')
        .select(`
            modifier_groups (
                *,
                modifier_options (*)
            )
        `)
        .eq('product_id', productId)
        .order('sort_order', { ascending: true })

    if (error) throw error
    return data?.map(d => d.modifier_groups) || []
}
