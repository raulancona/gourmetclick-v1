import { supabase } from './supabase'

/**
 * LinkCard Service
 * Handles CRUD for Linktree-style cards
 */

export async function getLinkCard(userId) {
    const { data, error } = await supabase
        .from('link_cards')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle()

    if (error) throw error
    return data
}

export async function getLinkCardBySlug(slug) {
    const { data, error } = await supabase
        .from('link_cards')
        .select('*')
        .eq('slug', slug)
        .maybeSingle()

    if (error) throw error
    return data
}

export async function upsertLinkCard(userId, cardData) {
    const { data, error } = await supabase
        .from('link_cards')
        .upsert({
            ...cardData,
            user_id: userId,
            updated_at: new Date().toISOString()
        })
        .select()
        .single()

    if (error) throw error
    return data
}
