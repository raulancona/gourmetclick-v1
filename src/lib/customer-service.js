import { supabase } from './supabase'

export async function getCustomers(restaurantId) {
    if (!restaurantId) throw new Error('Se requiere el ID del restaurante')

    const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('total_spent', { ascending: false })

    if (error) throw error
    return data || []
}
