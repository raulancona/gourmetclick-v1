import { supabase } from './supabase'

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
        .select('*')
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

export async function openSession(restaurantId, employeeId, initialAmount, openedByName = 'Desconocido') {
    const { data, error } = await supabase
        .from('sesiones_caja')
        .insert([{
            restaurante_id: restaurantId,
            empleado_id: employeeId,
            fondo_inicial: parseFloat(initialAmount),
            estado: 'abierta',
            opened_at: new Date().toISOString(),
            opened_by_user_name: openedByName
        }])
        .select()
        .single()

    if (error) throw error
    return data
}

export async function closeSession(sessionId, montoReal, userId, closedByName, expectedBalance) {
    // 1. Get session details to obtain the restaurant ID
    const { data: session, error: sessionError } = await supabase
        .from('sesiones_caja')
        .select('*')
        .eq('id', sessionId)
        .single()

    if (sessionError) throw sessionError

    const restaurantId = session.restaurante_id

    // 2. *** CRITICAL: Perform authoritative mathematical cutoff on the server ***
    //    RPC (SECURITY DEFINER) bypasses RLS, calculates the exact differences using all 
    //    global orders, creates the cash_cuts record, and stamps orders.
    const { data: rpcResult, error: stampError } = await supabase.rpc('stamp_cash_cut_orders', {
        p_session_id: sessionId,
        p_restaurant_id: restaurantId,
        p_user_id: userId || null,
        p_monto_real: parseFloat(montoReal),
        p_closed_by_name: closedByName
    })

    if (stampError) {
        console.error('Error in authoritative cash cut server calc:', stampError)
        throw stampError
    }

    return rpcResult
}

export async function getSessionsHistory(restaurantId, { page = 1, pageSize = 50 } = {}) {
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    const { data, error, count } = await supabase
        .from('sesiones_caja')
        .select('*', { count: 'exact' })
        .eq('restaurante_id', restaurantId)
        .order('opened_at', { ascending: false })
        .range(from, to)

    if (error) throw error
    return { data: data || [], count }
}

/**
 * Get all SHIFT cuts (cut_type='shift') for today for a restaurant.
 * Returns them with their linked session info.
 */
export async function getTodayShiftCuts(restaurantId) {
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const todayEnd = new Date()
    todayEnd.setHours(23, 59, 59, 999)

    const { data, error } = await supabase
        .from('cash_cuts')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .eq('cut_type', 'shift')
        .gte('cut_date', todayStart.toISOString())
        .lte('cut_date', todayEnd.toISOString())
        .order('cut_date', { ascending: true })

    if (error) throw error
    return data || []
}

/**
 * Check if a daily close already exists for today.
 */
export async function hasDailyClose(restaurantId) {
    const today = new Date().toISOString().split('T')[0]
    const { data, error } = await supabase
        .from('daily_closes')
        .select('id')
        .eq('restaurant_id', restaurantId)
        .eq('date', today)
        .maybeSingle()

    if (error) throw error
    return data !== null
}

/**
 * Get the daily close for today (or return null)
 */
export async function getTodayDailyClose(restaurantId) {
    const today = new Date().toISOString().split('T')[0]
    const { data, error } = await supabase
        .from('daily_closes')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .eq('date', today)
        .maybeSingle()

    if (error) throw error
    return data
}

/**
 * Create a daily close summarizing all shift cuts for today.
 * Only admin/gerente can call this (enforced by RLS).
 */
export async function createDailyClose(restaurantId, userId, closedByName, shiftCuts, sessionExpenses) {
    const alreadyClosed = await hasDailyClose(restaurantId)
    if (alreadyClosed) throw new Error('Ya existe un cierre total para hoy.')

    const totalShifts = shiftCuts.length
    const grossSales = shiftCuts.reduce((s, c) => s + (parseFloat(c.total_amount) || 0), 0)
    const totalCash = shiftCuts.reduce((s, c) => s + (parseFloat(c.total_cash) || 0), 0)
    const totalCard = shiftCuts.reduce((s, c) => s + (parseFloat(c.total_card) || 0), 0)
    const totalTransfer = shiftCuts.reduce((s, c) => s + (parseFloat(c.total_transfer) || 0), 0)
    const totalExpenses = (sessionExpenses || []).reduce((s, g) => s + (parseFloat(g.monto) || 0), 0)
    const netAmount = grossSales - totalExpenses

    const { data, error } = await supabase
        .from('daily_closes')
        .insert([{
            restaurant_id: restaurantId,
            closed_by: userId,
            closed_by_name: closedByName,
            date: new Date().toISOString().split('T')[0],
            total_shifts: totalShifts,
            gross_sales: grossSales,
            total_cash: totalCash,
            total_card: totalCard,
            total_transfer: totalTransfer,
            total_expenses: totalExpenses,
            net_amount: netAmount,
            shift_cut_ids: shiftCuts.map(c => c.id),
        }])
        .select()
        .single()

    if (error) throw error
    return data
}

/**
 * Get today's expenses for a restaurant (across all sessions today)
 */
export async function getTodayExpenses(restaurantId) {
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const { data, error } = await supabase
        .from('gastos')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .gte('created_at', todayStart.toISOString())
        .order('created_at', { ascending: true })

    if (error) throw error
    return data || []
}

