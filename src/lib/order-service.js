import { supabase } from './supabase'
import { getActiveSession } from './session-service'

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
        if (statuses && statuses.length > 0) {
            query = query.in('status', statuses)
        } else {
            query = query.not('status', 'in', '(delivered,cancelled)')
        }
    } else if (mode === 'caja') {
        // Delivered or cancelled but not yet part of a cash cut
        const statusFilter = (statuses && statuses.length > 0) ? statuses : ['delivered', 'cancelled']
        query = query
            .in('status', statusFilter)
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
            status: 'preparing', // Return to active flow
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


