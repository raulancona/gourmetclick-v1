/**
 * Generate WhatsApp order message from cart items
 * Enhanced with customer data, order type, delivery address, location, payment method, and notes
 */
export function generateWhatsAppMessage(items, restaurantName, customerName = '', customerPhone = '', deliveryAddress = null, notes = '', paymentMethod = '', locationUrl = '') {
    let message = `*🍽️ Nuevo Pedido - ${restaurantName}*\n`
    message += '━━━━━━━━━━━━━━━━━━━━━━━━\n\n'

    // Customer info
    if (customerName) {
        message += `👤 *Cliente:* ${customerName}\n`
    }
    if (customerPhone) {
        message += `📱 *Tel:* ${customerPhone}\n`
    }

    // Order type
    if (deliveryAddress) {
        if (deliveryAddress.startsWith('Mesa:')) {
            message += `🪑 *Tipo:* Comer en el lugar\n`
            message += `🔢 *${deliveryAddress}*\n`
        } else {
            message += `🛵 *Tipo:* Envío a domicilio\n`
            message += `📍 *Dirección:* ${deliveryAddress}\n`
        }
    } else {
        message += `🏪 *Tipo:* Paso a recoger\n`
    }

    // Location (Google Maps link)
    if (locationUrl) {
        message += `🗺️ *Ubicación:* ${locationUrl}\n`
    }

    // Payment method
    if (paymentMethod) {
        const paymentLabels = {
            cash: '💵 Efectivo',
            transfer: '🏦 Transferencia bancaria',
            card: '💳 Tarjeta (terminal)'
        }
        message += `💰 *Pago:* ${paymentLabels[paymentMethod] || paymentMethod}\n`
    }

    message += '\n━━━━━━━━━━━━━━━━━━━━━━━━\n\n'
    message += '*Detalle del pedido:*\n\n'

    items.forEach(item => {
        message += `▸ *${item.quantity}x ${item.product.name}*\n`

        if (item.modifiers && item.modifiers.length > 0) {
            item.modifiers.forEach(mod => {
                const priceText = parseFloat(mod.extra_price) > 0 ? ` (+$${parseFloat(mod.extra_price).toFixed(2)})` : ''
                message += `   ✓ ${mod.name}${priceText}\n`
            })
        }

        message += `   💲 $${item.subtotal.toFixed(2)}\n\n`
    })

    message += '━━━━━━━━━━━━━━━━━━━━━━━━\n'

    const total = items.reduce((sum, item) => sum + item.subtotal, 0)
    message += `\n💰 *TOTAL: $${total.toFixed(2)}*\n`

    if (notes) {
        message += `\n📝 *Notas:* ${notes}\n`
    }

    message += '\n_Pedido realizado desde el menú digital_ ✨'

    return message
}

/**
 * Open WhatsApp with order message
 */
export function sendWhatsAppOrder(phone, message) {
    const encodedMessage = encodeURIComponent(message)
    const whatsappUrl = `https://api.whatsapp.com/send?phone=${phone}&text=${encodedMessage}`
    window.open(whatsappUrl, '_blank')
}

/**
 * Generate WhatsApp message for Daily Cash Close (Corte de Caja)
 */
export function generateClosingSummary(restaurantName, summaryData) {
    const { totalSales, totalOrders, byPayment, date } = summaryData
    const formattedDate = new Date(date).toLocaleDateString('es-MX', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    })

    let message = `*📊 CORTE DE CAJA - ${restaurantName}*\n`
    message += `📅 ${formattedDate}\n`
    message += '━━━━━━━━━━━━━━━━━━━━━━━━\n\n'

    message += `💰 *Ventas Totales:* $${totalSales.toFixed(2)}\n`
    message += `🧾 *Órdenes Totales:* ${totalOrders}\n\n`

    message += '*Detalle por Método de Pago:*\n'
    if (byPayment.cash) message += `💵 *Efectivo:* $${byPayment.cash.toFixed(2)}\n`
    if (byPayment.card) message += `💳 *Tarjeta:* $${byPayment.card.toFixed(2)}\n`
    if (byPayment.transfer) message += `🏦 *Transferencia:* $${byPayment.transfer.toFixed(2)}\n`

    message += '\n━━━━━━━━━━━━━━━━━━━━━━━━\n'
    message += '✨ _Gourmet Click Pro - Reporte Generado_'

    return message
}
