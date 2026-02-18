import { supabase } from './supabase'

/**
 * Order Service — CRUD + status management
 */

const ORDER_STATUSES = {
    pending: { label: 'Pendiente', emoji: '🕐', color: '#F59E0B' },
    confirmed: { label: 'Confirmado', emoji: '✅', color: '#3B82F6' },
    preparing: { label: 'En preparación', emoji: '👨‍🍳', color: '#8B5CF6' },
    ready: { label: 'Listo', emoji: '📦', color: '#10B981' },
    on_the_way: { label: 'En camino', emoji: '🛵', color: '#6366F1' },
    delivered: { label: 'Entregado', emoji: '🎉', color: '#22C55E' },
    cancelled: { label: 'Cancelado', emoji: '❌', color: '#EF4444' },
}

export { ORDER_STATUSES }

export async function getOrders(userId) {
    const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
}

export async function createOrder(orderData) {
    const { data, error } = await supabase
        .from('orders')
        .insert([orderData])
        .select()
        .single()

    if (error) throw error
    return data
}

export async function updateOrderStatus(orderId, status, userId) {
    const { data, error } = await supabase
        .from('orders')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', orderId)
        .eq('user_id', userId)
        .select()
        .single()

    if (error) throw error
    return data
}

export async function updateOrder(orderId, updates, userId) {
    const { data, error } = await supabase
        .from('orders')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', orderId)
        .eq('user_id', userId)
        .select()
        .single()

    if (error) throw error
    return data
}

export async function deleteOrder(orderId, userId) {
    const { error } = await supabase
        .from('orders')
        .delete()
        .eq('id', orderId)
        .eq('user_id', userId)

    if (error) throw error
}

export async function getOrderStats(userId) {
    const { data, error } = await supabase
        .from('orders')
        .select('status, total, order_type, payment_method')
        .eq('user_id', userId)

    if (error) throw error

    const stats = {
        total: data.length,
        pending: data.filter(o => o.status === 'pending').length,
        active: data.filter(o => ['confirmed', 'preparing', 'ready', 'on_the_way'].includes(o.status)).length,
        delivered: data.filter(o => o.status === 'delivered').length,
        cancelled: data.filter(o => o.status === 'cancelled').length,
        revenue: data.filter(o => o.status === 'delivered').reduce((s, o) => s + parseFloat(o.total || 0), 0),

        // Distribution of order types
        orderTypes: {
            delivery: data.filter(o => o.order_type === 'delivery').length,
            pickup: data.filter(o => o.order_type === 'pickup').length,
            dine_in: data.filter(o => o.order_type === 'dine_in').length,
        },

        // Most used payment method
        paymentMethods: data.reduce((acc, o) => {
            acc[o.payment_method] = (acc[o.payment_method] || 0) + 1;
            return acc;
        }, {}),
    }

    // Identify most used payment
    const payments = Object.entries(stats.paymentMethods);
    if (payments.length > 0) {
        stats.topPayment = payments.sort((a, b) => b[1] - a[1])[0][0];
    } else {
        stats.topPayment = null;
    }

    return stats
}

export async function getSalesAnalytics(userId) {
    const { data: orders, error } = await supabase
        .from('orders')
        .select('items, total, created_at')
        .eq('user_id', userId)
        .neq('status', 'cancelled') // Exclude cancelled orders

    if (error) throw error

    // 1. Aggregate Sales by Product
    const productSales = {}
    let totalRevenue = 0

    orders.forEach(order => {
        // Ensure items is an array (handle potential legacy data or parse errors)
        const items = Array.isArray(order.items) ? order.items : []
        items.forEach(item => {
            const revenue = item.price * item.quantity
            if (!productSales[item.name]) {
                productSales[item.name] = {
                    id: item.id || item.name, // Fallback to name if id missing
                    name: item.name,
                    revenue: 0,
                    quantity: 0
                }
            }
            productSales[item.name].revenue += revenue
            productSales[item.name].quantity += item.quantity
            totalRevenue += revenue
        })
    })

    // 2. Sort and Classify (ABC Analysis)
    const sortedProducts = Object.values(productSales).sort((a, b) => b.revenue - a.revenue)

    let accumulatedRevenue = 0
    const abcData = sortedProducts.map(p => {
        accumulatedRevenue += p.revenue
        const percentage = (accumulatedRevenue / totalRevenue) * 100

        let category = 'C'
        if (percentage <= 80) category = 'A'
        else if (percentage <= 95) category = 'B'

        return { ...p, category, percentage: (p.revenue / totalRevenue) * 100 }
    })

    // 3. New Metrics Calculation

    // Average Ticket (Total stats are already filtered by neq cancelled in this query?)
    // The current query filters neq 'cancelled'.
    const validOrdersCount = orders.length
    const averageTicket = validOrdersCount > 0 ? totalRevenue / validOrdersCount : 0

    // Preparation Time (Placeholder as per request)
    const preparationTime = "Calculando..."

    // Recurring Customers
    const phoneCounts = {}
    let recurringOrdersCount = 0

    orders.forEach(order => {
        if (order.customer_phone) {
            // Normalize phone (simple trim)
            const phone = order.customer_phone.trim()
            if (phone) {
                phoneCounts[phone] = (phoneCounts[phone] || 0) + 1
            }
        }
    })

    // Count orders that belong to a recurring phone (appears > 1 time)
    orders.forEach(order => {
        const phone = order.customer_phone?.trim()
        if (phone && phoneCounts[phone] > 1) {
            recurringOrdersCount++
        }
    })

    const recurringCustomersPercentage = validOrdersCount > 0
        ? (recurringOrdersCount / validOrdersCount) * 100
        : 0


    // 4. Prepare Chart Data
    // Top 5 Products
    const topProducts = sortedProducts.slice(0, 5).map(p => ({
        name: p.name,
        revenue: p.revenue
    }))

    // Sales Trend (Last 7 days)
    const last7Days = [...Array(7)].map((_, i) => {
        const d = new Date()
        d.setDate(d.getDate() - i)
        return d.toISOString().split('T')[0]
    }).reverse()

    const salesTrend = last7Days.map(date => {
        const dayRevenue = orders
            .filter(o => o.created_at.startsWith(date))
            .reduce((sum, o) => sum + (parseFloat(o.total) || 0), 0)
        return { date, revenue: dayRevenue }
    })

    return {
        abcAnalysis: abcData, // Keeping this if needed elsewhere, but UI will ignore it
        topProducts,
        salesTrend,
        totalRevenue,
        metrics: {
            averageTicket,
            preparationTime,
            recurringCustomersPercentage
        }
    }
}
