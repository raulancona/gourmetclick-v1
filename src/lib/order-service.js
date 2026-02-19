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
    completed: { label: 'Completado', emoji: '🏁', color: '#111827' },
    cancelled: { label: 'Cancelado', emoji: '❌', color: '#EF4444' },
}

const PAYMENT_METHODS = {
    cash: { label: 'Efectivo', icon: '💵' },
    transfer: { label: 'Transferencia', icon: '🏦' },
    card: { label: 'Tarjeta', icon: '💳' },
}

function getNextStatuses(current) {
    const flow = {
        pending: ['confirmed'],
        confirmed: ['preparing'],
        preparing: ['ready'],
        ready: ['on_the_way', 'delivered'],
        on_the_way: ['delivered'],
    }
    return flow[current] || []
}

export { ORDER_STATUSES, PAYMENT_METHODS, getNextStatuses }

export async function getOrders(userId, { includeClosed = false, startDate = null, endDate = null } = {}) {
    let query = supabase
        .from('orders')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

    if (!includeClosed) {
        // Exclude both legacy closed (cash_cut_id) and new closed (completed)
        query = query.is('cash_cut_id', null).neq('status', 'completed')
    }

    if (startDate) {
        query = query.gte('created_at', startDate)
    }
    if (endDate) {
        query = query.lte('created_at', endDate)
    }

    const { data, error } = await query
    if (error) throw error
    return data || []
}

export async function createOrder(orderData) {
    console.log('🚀 Creating Order:', orderData)

    // 1. Snapshotting & Data Integrity
    // Ensure every item has fixed values at the moment of sale
    const snapshotItems = orderData.items?.map(item => ({
        ...item,
        unit_price: item.unit_price !== undefined ? parseFloat(item.unit_price) : parseFloat(item.price), // Priority to unit_price, fallback to price
        numericPrice: parseFloat(item.price), // Keep original for reference
        name: item.name || item.product?.name || 'Item Desconocido',
        product_id: item.product_id || item.product?.id,
        // Snapshots for database
        precio_unitario_snap: item.unit_price !== undefined ? parseFloat(item.unit_price) : parseFloat(item.price),
        costo_unitario_snap: item.product?.costo || item.costo || 0,
        // Calculate subtotal based on SNAPSHOTTED price
        subtotal: (item.unit_price !== undefined ? parseFloat(item.unit_price) : parseFloat(item.price)) * item.quantity
    })) || []

    // 2. Prepare Payload
    const payload = {
        ...orderData,
        items: snapshotItems
    }

    // Check for an active session to link this order
    const { data: activeSession } = await supabase
        .from('sesiones_caja')
        .select('id')
        .eq('restaurante_id', orderData.user_id)
        .eq('estado', 'abierta')
        .maybeSingle()

    if (!activeSession) {
        throw new Error('No es posible crear la orden: No hay una sesión de caja abierta.')
    }

    const finalPayload = {
        ...payload,
        sesion_caja_id: activeSession.id
    }

    console.log('📦 Processed Payload with Session:', finalPayload)

    try {
        const { data, error } = await supabase
            .from('orders')
            .insert([finalPayload])
            .select()
            .single()

        if (error) {
            console.error('❌ Supabase Insert Error:', error)
            throw error
        }

        console.log('✅ Order Created Successfully:', data)
        return data
    } catch (err) {
        console.error('🔥 CRITICAL: Failed to create order:', err.message)
        throw err
    }
}

export async function updateOrderStatus(orderId, status, userId) {
    const updates = {
        status,
        updated_at: new Date().toISOString()
    }

    // Set closing date if order is completed
    if (status === 'delivered' || status === 'completed') {
        updates.fecha_cierre = new Date().toISOString()
    }

    const { data, error } = await supabase
        .from('orders')
        .update(updates)
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

export async function getOrderStats(userId, { cashCutId = null, filterByShift = true, startDate = null, endDate = null } = {}) {
    let query = supabase
        .from('orders')
        .select('status, total, order_type, payment_method, created_at')
        .eq('user_id', userId)

    if (cashCutId) {
        query = query.eq('cash_cut_id', cashCutId)
    } else if (filterByShift) {
        query = query.is('cash_cut_id', null)
    } else {
        // Analytics Mode: Filter by date range
        if (startDate) {
            query = query.gte('created_at', startDate)
        }
        if (endDate) {
            query = query.lte('created_at', endDate)
        }
    }

    const { data, error } = await query

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

export async function getSalesAnalytics(userId, { cashCutId = null, filterByShift = true, startDate = null, endDate = null } = {}) {
    let query = supabase
        .from('orders')
        .select('items, total, created_at, customer_phone, status')
        .eq('user_id', userId)
        .neq('status', 'cancelled')

    if (cashCutId) {
        query = query.eq('cash_cut_id', cashCutId)
    } else if (filterByShift) {
        query = query.is('cash_cut_id', null)
    } else {
        // Analytics Mode: Filter by date range
        if (startDate) {
            query = query.gte('created_at', startDate)
        }
        if (endDate) {
            query = query.lte('created_at', endDate)
        }
    }

    const { data: orders, error } = await query

    if (error) throw error

    // 1. Aggregate Sales by Product
    const productSales = {}
    let totalRevenue = 0

    orders.forEach(order => {
        // Ensure items is an array (handle potential legacy data or parse errors)
        const items = Array.isArray(order.items) ? order.items : []
        items.forEach(item => {
            // Use subtotal if available (best snapshot), otherwise calc from unit_price or price
            const itemRevenue = item.subtotal !== undefined
                ? parseFloat(item.subtotal)
                : (item.unit_price !== undefined ? parseFloat(item.unit_price) : parseFloat(item.price)) * item.quantity

            if (!productSales[item.name]) {
                productSales[item.name] = {
                    id: item.product_id || item.id || item.name, // Fallback to name if id missing
                    name: item.name,
                    revenue: 0,
                    quantity: 0
                }
            }
            productSales[item.name].revenue += itemRevenue
            productSales[item.name].quantity += item.quantity
            totalRevenue += itemRevenue
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

/**
 * Fetch orders pending closing (Delivered status, but no cash cut)
 */
export async function getUnclosedOrders(userId) {
    // Determine the start of the current day (or further back if needed)
    // To be safe and catch orphans, we'll look at the last 1000 delivered orders
    // and filter in JS. This aligns logic exactly with the UI badges.
    const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'delivered')
        .order('created_at', { ascending: false })
        .limit(1000)

    if (error) throw error

    // Filter client-side to match the UI's "falsy" check
    // This catches null, undefined, and empty strings
    return (data || []).filter(o => !o.cash_cut_id)
}

/**
 * Create a new cash cut and link orders to it
 */
export async function createCashCut(userId, summary, orderIds) {
    if (!orderIds || orderIds.length === 0) throw new Error('No hay órdenes para cerrar')

    // 1. Create the cash cut record
    const { data: cut, error: cutError } = await supabase
        .from('cash_cuts')
        .insert([{
            restaurant_id: userId,
            user_id: userId,
            total_cash: summary.byPayment.cash,
            total_card: summary.byPayment.card,
            total_transfer: summary.byPayment.transfer,
            total_amount: summary.totalSales,
            order_count: summary.totalOrders,
            cut_date: new Date().toISOString()
        }])
        .select()
        .single()

    if (cutError) throw cutError

    // 2. Link orders to this cut
    const { error: updateError } = await supabase
        .from('orders')
        .update({ cash_cut_id: cut.id })
        .in('id', orderIds)
        .eq('user_id', userId)

    if (updateError) throw updateError

    return cut
}

/**
 * Fetch all cash cuts for reports
 */
export async function getCashCuts(userId) {
    const { data, error } = await supabase
        .from('cash_cuts')
        .select('*')
        .eq('user_id', userId)
        .order('cut_date', { ascending: false })

    if (error) throw error
    return data || []
}

/**
 * Financial Summary for a specific Session
 */
export async function getSessionFinancialSummary(sessionId) {
    // 1. Get session info so we know the time range
    const { data: session, error: sessionError } = await supabase
        .from('sesiones_caja')
        .select('opened_at, closed_at, restaurante_id')
        .eq('id', sessionId)
        .single()

    if (sessionError) throw sessionError

    const startTime = session.opened_at
    const endTime = session.closed_at || new Date().toISOString()

    // 2. Get ALL delivered orders for this restaurant in the session's time range
    //    (covers both linked orders via sesion_caja_id AND legacy orders without it)
    const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('total, payment_method, id')
        .eq('user_id', session.restaurante_id)
        .in('status', ['delivered', 'completed'])
        .gte('created_at', startTime)
        .lte('created_at', endTime)

    if (ordersError) throw ordersError

    // 3. Get expenses linked to this session
    const { data: gastos, error: gastosError } = await supabase
        .from('gastos')
        .select('monto')
        .eq('sesion_caja_id', sessionId)

    if (gastosError) throw gastosError

    const totalSales = (orders || []).reduce((sum, o) => sum + (parseFloat(o.total) || 0), 0)
    const totalExpenses = (gastos || []).reduce((sum, g) => sum + (parseFloat(g.monto) || 0), 0)

    const byPayment = (orders || []).reduce((acc, o) => {
        const method = o.payment_method || 'cash'
        acc[method] = (acc[method] || 0) + parseFloat(o.total || 0)
        return acc
    }, { cash: 0, card: 0, transfer: 0 })

    return {
        totalSales,
        totalExpenses,
        byPayment,
        orderIds: (orders || []).map(o => o.id)
    }
}

/**
 * Perform Blind Cash Cut
 */
export async function createBlindCashCut(userId, montoReal) {
    const summary = await getDailyFinancialSummary(userId)
    const montoEsperado = summary.expectedBalance
    const diferencia = parseFloat(montoReal) - montoEsperado

    // 1. Insert into cortes_caja
    const { data: cut, error: cutError } = await supabase
        .from('cortes_caja')
        .insert([{
            usuario_id: userId,
            monto_esperado: montoEsperado,
            monto_real: parseFloat(montoReal),
            diferencia: diferencia
        }])
        .select()
        .single()

    if (cutError) throw cutError

    // 2. Mark orders as closed (using legacy cash_cut_id column for now to maintain compatibility)
    if (summary.orderIds.length > 0) {
        const { error: updateError } = await supabase
            .from('orders')
            .update({ cash_cut_id: cut.id }) // Using the new cut ID
            .in('id', summary.orderIds)
            .eq('user_id', userId)

        if (updateError) throw updateError
    }

    return cut
}

/**
 * Session Management
 */
export async function getActiveSession(userId) {
    const { data, error } = await supabase
        .from('sesiones_caja')
        .select('*, empleado:empleado_id(nombre)')
        .eq('restaurante_id', userId)
        .eq('estado', 'abierta')
        .maybeSingle()

    if (error) throw error
    return data
}

export async function openSession(userId, employeeId, initialAmount) {
    const { data, error } = await supabase
        .from('sesiones_caja')
        .insert([{
            restaurante_id: userId,
            empleado_id: employeeId,
            fondo_inicial: parseFloat(initialAmount),
            estado: 'abierta',
            opened_at: new Date().toISOString()
        }])
        .select()
        .single()

    if (error) throw error
    return data
}

export async function closeSession(sessionId, montoReal, userId) {
    // 1. Get session details and financial summary
    const { data: session, error: sessionError } = await supabase
        .from('sesiones_caja')
        .select('*')
        .eq('id', sessionId)
        .single()

    if (sessionError) throw sessionError

    // 2. Calculate totals for THIS session
    const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('total')
        .eq('sesion_caja_id', sessionId)
        .eq('status', 'delivered')

    if (ordersError) throw ordersError

    const { data: gastos, error: gastosError } = await supabase
        .from('gastos')
        .select('monto')
        .eq('sesion_caja_id', sessionId)

    if (gastosError) throw gastosError

    const totalSales = (orders || []).reduce((sum, o) => sum + (parseFloat(o.total) || 0), 0)
    const totalExpenses = (gastos || []).reduce((sum, g) => sum + (parseFloat(g.monto) || 0), 0)
    const currentInventory = parseFloat(session.fondo_inicial) + totalSales - totalExpenses
    const diferencia = parseFloat(montoReal) - currentInventory

    // 3. Update session
    const { data: closedSession, error: updateError } = await supabase
        .from('sesiones_caja')
        .update({
            estado: 'cerrada',
            monto_esperado: currentInventory,
            monto_real: parseFloat(montoReal),
            diferencia: diferencia,
            closed_at: new Date().toISOString()
        })
        .eq('id', sessionId)
        .select()
        .single()

    if (updateError) throw updateError

    // 4. Close orders (Mark as completed)
    const { error: closeOrdersError } = await supabase
        .from('orders')
        .update({
            status: 'completed',
            fecha_cierre: new Date().toISOString()
        })
        .eq('sesion_caja_id', sessionId)
        .eq('status', 'delivered')

    if (closeOrdersError) {
        console.error('Error closing orders:', closeOrdersError)
        // We don't throw here to avoid failing the session close if just status update fails, 
        // but it's important. ideally we should transaction.
        // For now logging is safer than rolling back session close manually.
    }

    return closedSession
}

export async function getSessionsHistory(userId) {
    const { data, error } = await supabase
        .from('sesiones_caja')
        .select('*, empleado:empleado_id(nombre)')
        .eq('restaurante_id', userId)
        .order('opened_at', { ascending: false })

    if (error) throw error
    return data || []
}
