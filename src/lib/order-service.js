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

/**
 * getOrders — Single source of truth for all three order sections.
 *
 * mode:
 *   'active'   → status NOT IN (delivered, cancelled)  [Operación Activa]
 *   'caja'     → status IN (delivered, cancelled) AND cash_cut_id IS NULL  [Por Liquidar]
 *   'historial'→ cash_cut_id IS NOT NULL  [Historial y Auditoría]
 *   null/other → legacy fallback using includeClosed + statuses filters
 */
export async function getOrders(restaurantId, {
    mode = null,
    includeClosed = false,
    startDate = null,
    endDate = null,
    page = 1,
    pageSize = 50,
    statuses = null,
    paymentMethod = null,
    cashCutFilter = 'all'
} = {}) {
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    let query = supabase
        .from('orders')
        .select('*', { count: 'exact' })
        .or(`restaurant_id.eq.${restaurantId},user_id.eq.${restaurantId}`)
        .order('created_at', { ascending: false })
        .range(from, to)

    // Mode-based filtering (canonical logic, replaces session-lookup approach)
    if (mode === 'active') {
        // All live orders regardless of session
        query = query.not('status', 'in', '(delivered,cancelled)')
    } else if (mode === 'caja') {
        // Delivered or cancelled but not yet part of a cash cut
        query = query
            .in('status', ['delivered', 'cancelled'])
            .is('cash_cut_id', null)
    } else if (mode === 'historial') {
        // Only orders formally closed by a cash cut
        query = query.not('cash_cut_id', 'is', null)
    } else {
        // Legacy fallback for backwards-compat (reports, analytics, etc.)
        if (!includeClosed) {
            query = query.not('status', 'in', '(delivered,cancelled)')
        }
        if (statuses && statuses.length > 0) {
            query = query.in('status', statuses)
        }
        if (cashCutFilter === 'unpaid') {
            query = query.is('cash_cut_id', null)
        } else if (cashCutFilter === 'paid') {
            query = query.not('cash_cut_id', 'is', null)
        }
    }

    if (startDate) query = query.gte('created_at', startDate)
    if (endDate) query = query.lte('created_at', endDate)
    if (paymentMethod) query = query.eq('payment_method', paymentMethod)

    const { data, error, count } = await query
    if (error) throw error

    return { data: data || [], count }
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

    // tenant ID used for session lookup and payload
    const searchTenantId = orderData.restaurant_id || orderData.user_id;

    // Determine FIRST if it is a public order (customer-originated)
    // pickup & delivery never require a cash session — customers don't open a register
    const isPublicOrder = ['pickup', 'delivery'].includes(orderData.order_type);

    let activeSession = null;

    if (!isPublicOrder) {
        // Only look up session for internal orders (dine_in from POS/dashboard)
        try {
            activeSession = await getActiveSession(searchTenantId);
        } catch (e) {
            console.error('Error fetching session for order:', e);
        }

        if (!activeSession) {
            throw new Error(`No es posible crear la orden: No hay una sesión de caja abierta para el tenant ${searchTenantId}. (order_type: ${orderData.order_type})`);
        }
    }

    const finalStatus = (!activeSession && isPublicOrder) ? 'pending' : (payload.status || 'pending')

    // audit_log is internal — public (anon) orders skip it to avoid 401 on SELECT after INSERT
    const auditEntry = isPublicOrder ? undefined : [{
        action: 'CREATED',
        timestamp: new Date().toISOString(),
        user: 'Sistema/Staff',
        details: 'Orden creada'
    }]

    const finalPayload = {
        ...payload,
        sesion_caja_id: activeSession?.id || null,
        restaurant_id: searchTenantId,
        user_id: payload.user_id || activeSession?.empleado_id || searchTenantId,
        status: finalStatus,
        ...(auditEntry ? { audit_log: auditEntry } : {})
    }

    console.log('📦 Processed Payload:', finalPayload)

    try {
        // Public orders use minimal select to avoid RLS issues on audit_log column
        const selectFields = isPublicOrder ? 'id, folio, tracking_id, status' : '*'

        const { data, error } = await supabase
            .from('orders')
            .insert([finalPayload])
            .select(selectFields)
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

export async function updateOrderStatus(orderId, status, restaurantId, userName = 'Sistema') {
    // Get current order to append audit log
    const { data: currentOrder } = await supabase
        .from('orders')
        .select('status, audit_log')
        .eq('id', orderId)
        .single();

    const currentAuditLog = currentOrder?.audit_log || [];
    const prevStatus = currentOrder?.status || 'desconocido';

    const updates = {
        status,
        updated_at: new Date().toISOString(),
        audit_log: [...currentAuditLog, {
            action: 'STATUS_CHANGE',
            timestamp: new Date().toISOString(),
            user: userName,
            details: `Estado cambiado de ${ORDER_STATUSES[prevStatus]?.label || prevStatus} a ${ORDER_STATUSES[status]?.label || status}`
        }]
    }

    // Set closing date if order is delivered or cancelled
    if (status === 'delivered' || status === 'cancelled') {
        updates.fecha_cierre = new Date().toISOString()
    }

    const { data, error } = await supabase
        .from('orders')
        .update(updates)
        .eq('id', orderId)
        .or(`restaurant_id.eq.${restaurantId},user_id.eq.${restaurantId}`)
        .select()
        .single()

    if (error) throw error
    return data
}

export async function updateOrder(orderId, updates, restaurantId, userName = 'Sistema') {
    // Get current order to append audit log
    const { data: currentOrder } = await supabase
        .from('orders')
        .select('audit_log')
        .eq('id', orderId)
        .single();

    const currentAuditLog = currentOrder?.audit_log || [];

    const finalUpdates = {
        ...updates,
        updated_at: new Date().toISOString(),
        audit_log: [...currentAuditLog, {
            action: 'UPDATED',
            timestamp: new Date().toISOString(),
            user: userName,
            details: 'Orden editada (productos/notas/tipo)'
        }]
    }

    const { data, error } = await supabase
        .from('orders')
        .update(finalUpdates)
        .eq('id', orderId)
        .or(`restaurant_id.eq.${restaurantId},user_id.eq.${restaurantId}`)
        .select()
        .single()

    if (error) throw error
    return data
}

export async function deleteOrder(orderId, restaurantId, { force = false } = {}) {
    // Guard: never delete orders that are part of a cash cut (historial)
    const { data: order, error: fetchError } = await supabase
        .from('orders')
        .select('cash_cut_id, status, folio')
        .eq('id', orderId)
        .single()

    if (fetchError) throw fetchError

    if (order?.cash_cut_id && !force) {
        throw new Error(
            `La orden #${order.folio || orderId.slice(0, 6)} está incluida en un corte de caja y no puede eliminarse. Contacta a tu administrador.`
        )
    }

    const { error } = await supabase
        .from('orders')
        .delete()
        .eq('id', orderId)
        .or(`restaurant_id.eq.${restaurantId},user_id.eq.${restaurantId}`)

    if (error) throw error
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

/**
 * Reopen a delivered/closed order — removes cash_cut_id and fecha_cierre,
 * puts it back into 'delivered' so it shows in the Caja (Por Liquidar) section.
 */
export async function reopenOrder(orderId, restaurantId, userName = 'Admin') {
    const { data: current } = await supabase
        .from('orders')
        .select('audit_log')
        .eq('id', orderId)
        .single()

    const auditLog = current?.audit_log || []

    const { data, error } = await supabase
        .from('orders')
        .update({
            fecha_cierre: null,
            status: 'delivered',
            updated_at: new Date().toISOString(),
            audit_log: [...auditLog, {
                action: 'REOPENED',
                timestamp: new Date().toISOString(),
                user: userName,
                details: 'Orden reabierta por administrador'
            }]
        })
        .eq('id', orderId)
        .or(`restaurant_id.eq.${restaurantId},user_id.eq.${restaurantId}`)
        .select()
        .single()

    if (error) throw error
    return data
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

/**
 * Fetch orders pending closing — matches exactly what Por Liquidar shows:
 * ANY order (delivered OR cancelled) without a cash_cut_id, any session.
 */
export async function getUnclosedOrders(restaurantId) {
    const { data, error } = await supabase
        .from('orders')
        .select('*')
        .or(`restaurant_id.eq.${restaurantId},user_id.eq.${restaurantId}`)
        .in('status', ['delivered', 'cancelled'])
        .is('cash_cut_id', null)
        .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
}

/**
 * Create a new cash cut and link orders to it
 */
export async function createCashCut(restaurantId, summary, orderIds) {
    if (!orderIds || orderIds.length === 0) throw new Error('No hay órdenes para cerrar')

    // 1. Create the cash cut record
    const { data: cut, error: cutError } = await supabase
        .from('cash_cuts')
        .insert([{
            restaurant_id: restaurantId,
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
        .or(`restaurant_id.eq.${restaurantId},user_id.eq.${restaurantId}`)

    if (updateError) throw updateError

    return cut
}

/**
 * Fetch all cash cuts for reports
 */
export async function getCashCuts(restaurantId) {
    const { data, error } = await supabase
        .from('cash_cuts')
        .select('*')
        .eq('restaurant_id', restaurantId)
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

    // 2. Get ALL delivered orders for this session specifically
    const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('id, folio, total, payment_method, status, customer_name, order_type, table_number, items, created_at')
        .eq('sesion_caja_id', sessionId)
        .eq('status', 'delivered')
        .order('created_at', { ascending: false })

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
        orderIds: (orders || []).map(o => o.id),
        orders: orders || [],  // Full order list for detail view
    }
}

/**
 * Get Financial Summary for the active session (used for Blind Cut)
 */
export async function getDailyFinancialSummary(restaurantId) {
    const activeSession = await getActiveSession(restaurantId)
    if (!activeSession) return { expectedBalance: 0, orderIds: [], totalSales: 0, totalExpenses: 0 }

    const summary = await getSessionFinancialSummary(activeSession.id)

    return {
        ...summary,
        expectedBalance: parseFloat(activeSession.fondo_inicial || 0) + summary.byPayment.cash - summary.totalExpenses
    }
}

/**
 * Perform Blind Cash Cut
 */
export async function createBlindCashCut(restaurantId, montoReal) {
    const summary = await getDailyFinancialSummary(restaurantId) // Assuming getDailyFinancialSummary also needs update or exists
    const montoEsperado = summary.expectedBalance
    const diferencia = parseFloat(montoReal) - montoEsperado

    // 1. Insert into cortes_caja
    const { data: cut, error: cutError } = await supabase
        .from('cortes_caja')
        .insert([{
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
            .or(`restaurant_id.eq.${restaurantId},user_id.eq.${restaurantId}`)

        if (updateError) throw updateError
    }

    return cut
}

/**
 * Session Management
 */
export async function getActiveSession(restaurantId) {
    const { data: sessions, error } = await supabase
        .from('sesiones_caja')
        .select('*, empleado:empleado_id(nombre)')
        .eq('restaurante_id', restaurantId)
        .eq('estado', 'abierta')
        .order('opened_at', { ascending: false })

    if (error) throw error
    if (!sessions || sessions.length === 0) return null

    // Autocorrección de sesiones huérfanas / duplicadas (Caso Borde 1 - Opción A)
    if (sessions.length > 1) {
        const [activeSession, ...orphanSessions] = sessions
        const orphanIds = orphanSessions.map(s => s.id)

        console.warn(`[Auto-Correction] Cerrando forzosamente ${orphanIds.length} sesiones duplicadas para tenant ${restaurantId}`)

        const { error: updateError } = await supabase
            .from('sesiones_caja')
            .update({
                estado: 'cerrada',
                closed_at: new Date().toISOString(),
                notas: 'Cierre forzado automático (sesión huérfana/duplicada)'
            })
            .in('id', orphanIds)

        if (updateError) {
            console.error('Failed to auto-close orphan sessions:', updateError)
        }

        return activeSession
    }

    return sessions[0]
}

export async function openSession(restaurantId, employeeId, initialAmount) {
    const { data, error } = await supabase
        .from('sesiones_caja')
        .insert([{
            restaurante_id: restaurantId,
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

export async function closeSession(sessionId, montoReal, userId, closedByName, expectedBalance) {
    // 1. Get session details
    const { data: session, error: sessionError } = await supabase
        .from('sesiones_caja')
        .select('*')
        .eq('id', sessionId)
        .single()

    if (sessionError) throw sessionError

    const restaurantId = session.restaurante_id

    // 2. Calculate totals for THIS session (only delivered orders contribute to revenue)
    const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('total, payment_method')
        .eq('sesion_caja_id', sessionId)
        .eq('status', 'delivered')

    if (ordersError) throw ordersError

    const { data: gastos, error: gastosError } = await supabase
        .from('gastos')
        .select('monto')
        .eq('sesion_caja_id', sessionId)

    if (gastosError) throw gastosError

    // Security: Recalculate server-side using ONLY cash payments for physical balance
    const cashSales = (orders || [])
        .filter(o => (o.payment_method || 'cash') === 'cash')
        .reduce((sum, o) => sum + (parseFloat(o.total) || 0), 0)

    const totalExpenses = (gastos || []).reduce((sum, g) => sum + (parseFloat(g.monto) || 0), 0)

    const finalExpectedBalance = parseFloat(session.fondo_inicial || 0) + cashSales - totalExpenses
    const diferencia = parseFloat(montoReal) - finalExpectedBalance

    // 3. Close the session
    const { data: closedSession, error: updateError } = await supabase
        .from('sesiones_caja')
        .update({
            estado: 'cerrada',
            monto_esperado: finalExpectedBalance,
            monto_real: parseFloat(montoReal),
            diferencia: diferencia,
            closed_at: new Date().toISOString(),
            cerrado_por: userId,
            nombre_cajero: closedByName
        })
        .eq('id', sessionId)
        .select()
        .single()

    if (updateError) throw updateError

    // 4. *** CRITICAL: Create cash_cuts record and stamp ALL Por Liquidar orders ***
    //    RPC (SECURITY DEFINER) bypasses RLS, creates the cash_cuts record,
    //    and stamps delivered + cancelled orders with the new cut's ID.
    const { error: stampError } = await supabase.rpc('stamp_cash_cut_orders', {
        p_session_id: sessionId,
        p_restaurant_id: restaurantId,
        p_user_id: userId || null
    })

    if (stampError) {
        console.error('Error stamping cash_cut_id on orders:', stampError)
        // Non-fatal: session is already closed, log and continue
    }

    return closedSession
}

export async function getSessionsHistory(restaurantId, { page = 1, pageSize = 50 } = {}) {
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    const { data, error, count } = await supabase
        .from('sesiones_caja')
        .select('*, empleado:empleado_id(nombre)', { count: 'exact' })
        .eq('restaurante_id', restaurantId)
        .order('opened_at', { ascending: false })
        .range(from, to)

    if (error) throw error
    return { data: data || [], count }
}
