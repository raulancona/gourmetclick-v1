import { supabase } from './supabase'

/**
 * Normalizes start and end dates for database querying (UTC handling)
 */
export function getQueryDates(startDate, endDate) {
    const start = new Date(startDate)
    start.setHours(0, 0, 0, 0)

    const end = new Date(endDate)
    end.setHours(23, 59, 59, 999)

    return {
        startIso: start.toISOString(),
        endIso: end.toISOString()
    }
}

/**
 * Formats a Date object into 'YYYY-MM-DD' for grouping in JS
 */
function toLocalDateString(isoString) {
    const d = new Date(isoString);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * 1. Resumen Ejecutivo (Kardex Superior)
 */
export async function getExecutiveSummary(restaurantId, startDate, endDate) {
    const { startIso, endIso } = getQueryDates(startDate, endDate)

    // Solo ventas entregadas cuentan como ingreso real
    const { data: salesError, data: sales } = await supabase
        .from('orders')
        .select('total, payment_method')
        .or(`restaurant_id.eq.${restaurantId},user_id.eq.${restaurantId}`)
        .eq('status', 'delivered')
        .gte('created_at', startIso)
        .lte('created_at', endIso)

    const { data: expensesError, data: expenses } = await supabase
        .from('gastos')
        .select('monto')
        .eq('restaurante_id', restaurantId)
        .gte('created_at', startIso)
        .lte('created_at', endIso)

    const totalSales = (sales || []).reduce((sum, order) => sum + parseFloat(order.total || 0), 0)
    const totalExpenses = (expenses || []).reduce((sum, g) => sum + parseFloat(g.monto || 0), 0)

    const cashSales = (sales || []).filter(o => o.payment_method === 'cash').reduce((sum, o) => sum + parseFloat(o.total || 0), 0)
    const cardSales = (sales || []).filter(o => o.payment_method === 'card').reduce((sum, o) => sum + parseFloat(o.total || 0), 0)
    const transferSales = (sales || []).filter(o => o.payment_method === 'transfer').reduce((sum, o) => sum + parseFloat(o.total || 0), 0)

    return {
        totalSales,
        totalExpenses,
        netProfit: totalSales - totalExpenses,
        breakdown: {
            cash: cashSales,
            card: cardSales,
            transfer: transferSales
        }
    }
}

/**
 * 2. Analítica Detallada de Ventas (Tab 1)
 */
export async function getSalesAnalytics(restaurantId, startDate, endDate) {
    const { startIso, endIso } = getQueryDates(startDate, endDate)

    const { data: orders, error } = await supabase
        .from('orders')
        .select('*')
        .or(`restaurant_id.eq.${restaurantId},user_id.eq.${restaurantId}`)
        .gte('created_at', startIso)
        .lte('created_at', endIso)
        .order('created_at', { ascending: false })

    if (error) throw error

    const deliveredOrders = orders.filter(o => o.status === 'delivered')
    const cancelledOrders = orders.filter(o => o.status === 'cancelled')

    const totalRevenue = deliveredOrders.reduce((sum, o) => sum + parseFloat(o.total || 0), 0)
    const ticketPromedio = deliveredOrders.length > 0 ? totalRevenue / deliveredOrders.length : 0

    // Agrupar ventas por día para el gráfico
    const salesByDay = {}
    deliveredOrders.forEach(order => {
        const dateKey = toLocalDateString(order.created_at)
        salesByDay[dateKey] = (salesByDay[dateKey] || 0) + parseFloat(order.total || 0)
    })

    // Transformar a array ordenado para Recharts
    const chartData = Object.entries(salesByDay)
        .map(([date, total]) => ({ date, total }))
        .sort((a, b) => a.date.localeCompare(b.date))

    return {
        rawOrders: orders,
        deliveredOrders,
        kpis: {
            totalRevenue,
            ticketPromedio,
            deliveredCount: deliveredOrders.length,
            cancelledCount: cancelledOrders.length
        },
        chartData
    }
}

/**
 * 3. Analítica Detallada de Gastos (Tab 2)
 */
export async function getExpensesAnalytics(restaurantId, startDate, endDate) {
    const { startIso, endIso } = getQueryDates(startDate, endDate)

    const { data: expenses, error } = await supabase
        .from('gastos')
        .select('*, empleado:empleado_id(nombre)')
        .eq('restaurante_id', restaurantId)
        .gte('created_at', startIso)
        .lte('created_at', endIso)
        .order('created_at', { ascending: false })

    if (error) throw error

    const totalGastos = expenses.reduce((sum, g) => sum + parseFloat(g.monto || 0), 0)

    // Agrupar por categoría
    const byCategory = {}
    expenses.forEach(g => {
        const cat = g.categoria || 'Otros'
        byCategory[cat] = (byCategory[cat] || 0) + parseFloat(g.monto || 0)
    })

    const chartData = Object.entries(byCategory).map(([name, value]) => ({
        name,
        value
    })).sort((a, b) => b.value - a.value)

    return {
        rawExpenses: expenses,
        totalGastos,
        chartData
    }
}

/**
 * 4. Analítica de Cortes de Caja (Tab 3)
 */
export async function getCashCutAnalytics(restaurantId, startDate, endDate) {
    const { startIso, endIso } = getQueryDates(startDate, endDate)

    const { data: cuts, error } = await supabase
        .from('sesiones_caja')
        .select('*, empleado:empleado_id(nombre)')
        .eq('restaurante_id', restaurantId)
        .eq('estado', 'cerrada')
        .gte('closed_at', startIso)
        .lte('closed_at', endIso)
        .order('closed_at', { ascending: false })

    if (error) throw error

    const totalDeclared = cuts.reduce((sum, s) => sum + parseFloat(s.monto_real || 0), 0)
    const totalDiff = cuts.reduce((sum, s) => sum + parseFloat(s.diferencia || 0), 0)
    const perfectCuts = cuts.filter(s => parseFloat(s.diferencia || 0) === 0).length

    return {
        rawCuts: cuts,
        kpis: {
            totalCuts: cuts.length,
            totalDeclared,
            totalDiff,
            perfectCuts
        }
    }
}
