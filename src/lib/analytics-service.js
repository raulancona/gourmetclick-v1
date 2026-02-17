import { supabase } from './supabase'

/**
 * Analytics Service
 * Track and retrieve menu visit analytics
 */

/**
 * Track a menu visit
 */
export async function trackVisit(restaurantId, userAgent = null, ipAddress = null) {
    const { error } = await supabase
        .from('analytics')
        .insert([{
            restaurant_id: restaurantId,
            user_agent: userAgent,
            ip_address: ipAddress
        }])

    if (error) console.error('Analytics tracking error:', error)
}

/**
 * Get total visits for a restaurant
 */
export async function getTotalVisits(restaurantId) {
    const { count, error } = await supabase
        .from('analytics')
        .select('*', { count: 'exact', head: true })
        .eq('restaurant_id', restaurantId)

    if (error) throw error
    return count || 0
}

/**
 * Get visits for a time period
 */
export async function getVisitsByPeriod(restaurantId, startDate, endDate) {
    const { data, error } = await supabase
        .from('analytics')
        .select('visited_at')
        .eq('restaurant_id', restaurantId)
        .gte('visited_at', startDate.toISOString())
        .lte('visited_at', endDate.toISOString())
        .order('visited_at', { ascending: true })

    if (error) throw error
    return data || []
}

/**
 * Get visits this week
 */
export async function getVisitsThisWeek(restaurantId) {
    const now = new Date()
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    const { count, error } = await supabase
        .from('analytics')
        .select('*', { count: 'exact', head: true })
        .eq('restaurant_id', restaurantId)
        .gte('visited_at', weekAgo.toISOString())

    if (error) throw error
    return count || 0
}

/**
 * Get visits this month
 */
export async function getVisitsThisMonth(restaurantId) {
    const now = new Date()
    const monthAgo = new Date(now.getFullYear(), now.getMonth(), 1)

    const { count, error } = await supabase
        .from('analytics')
        .select('*', { count: 'exact', head: true })
        .eq('restaurant_id', restaurantId)
        .gte('visited_at', monthAgo.toISOString())

    if (error) throw error
    return count || 0
}

/**
 * Get analytics summary for dashboard
 */
export async function getAnalyticsSummary(restaurantId) {
    const [total, thisWeek, thisMonth] = await Promise.all([
        getTotalVisits(restaurantId),
        getVisitsThisWeek(restaurantId),
        getVisitsThisMonth(restaurantId)
    ])

    return {
        total,
        thisWeek,
        thisMonth
    }
}
