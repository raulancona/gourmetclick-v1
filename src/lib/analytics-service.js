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
        .or(`restaurant_id.eq.${restaurantId},user_id.eq.${restaurantId}`)

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
        .or(`restaurant_id.eq.${restaurantId},user_id.eq.${restaurantId}`)
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
        .or(`restaurant_id.eq.${restaurantId},user_id.eq.${restaurantId}`)
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
        .or(`restaurant_id.eq.${restaurantId},user_id.eq.${restaurantId}`)
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

export async function getOrderStats(restaurantId, { cashCutId = null, filterByShift = false, startDate = null, endDate = null, sessionId = null } = {}) {
    const { data: stats, error } = await supabase.rpc('get_order_stats_v2', {
        p_restaurant_id: restaurantId,
        p_start_date: startDate,
        p_end_date: endDate,
        p_session_id: sessionId,
        p_cash_cut_id: cashCutId,
        p_filter_by_shift: filterByShift
    })

    if (error) throw error

    const payments = Object.entries(stats.paymentMethods || {})
    stats.topPayment = payments.length > 0
        ? payments.sort((a, b) => b[1] - a[1])[0][0]
        : null

    return stats
}

export async function getSalesAnalytics(restaurantId, { cashCutId = null, filterByShift = false, startDate = null, endDate = null, sessionId = null } = {}) {
    const { data: analytics, error } = await supabase.rpc('get_sales_analytics_v2', {
        p_restaurant_id: restaurantId,
        p_start_date: startDate,
        p_end_date: endDate,
        p_session_id: sessionId,
        p_cash_cut_id: cashCutId,
        p_filter_by_shift: filterByShift
    })

    if (error) throw error

    // Ensure backwards compatibility by formatting empty arrays or padding dates if needed
    // Calculate full 7 days for salesTrend if necessary:
    const last7Days = [...Array(7)].map((_, i) => {
        const d = new Date()
        d.setDate(d.getDate() - i)
        return d.toISOString().split('T')[0]
    }).reverse()

    const salesTrendMap = new Map((analytics.salesTrend || []).map(st => [st.date, parseFloat(st.revenue) || 0]))
    const paddedSalesTrend = last7Days.map(date => ({
        date,
        revenue: salesTrendMap.get(date) || 0
    }))

    // Calculate ABC analysis locally relative to total revenue is fine, as topProducts handles most of the rank constraint.
    // However, topProducts from RPC only limits to 10 for dashboard display.
    const productSales = analytics.topProducts || []

    // Add "quantity" fallback if it wasn't captured correctly in legacy rows
    const topProducts = productSales.map(p => ({
        name: p.name,
        revenue: parseFloat(p.revenue || 0),
        quantity: parseInt(p.quantity || 0)
    }))

    return {
        abcAnalysis: topProducts, // Minimal fallback
        topProducts,
        salesTrend: (analytics.salesTrend && analytics.salesTrend.length > 0) ? analytics.salesTrend : paddedSalesTrend,
        totalRevenue: analytics.totalRevenue || 0,
        metrics: {
            averageTicket: analytics.metrics?.averageTicket || 0,
            preparationTime: analytics.metrics?.preparationTime || "Calculando...",
            recurringCustomersPercentage: analytics.metrics?.recurringCustomersPercentage || 0
        }
    }
}
