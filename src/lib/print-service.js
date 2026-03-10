/**
 * print-service.js
 * Generates and triggers browser print dialogs for shift and daily close reports.
 * Uses a hidden printable div with inline styles so it works without extra dependencies.
 */

import { formatCurrency } from './utils'

function printHtml(html) {
    const win = window.open('', '_blank', 'width=800,height=900')
    if (!win) { alert('Por favor, permite las ventanas emergentes para imprimir el reporte.'); return }
    win.document.write(html)
    win.document.close()
    win.focus()
    setTimeout(() => { win.print(); win.close() }, 600)
}

const baseStyles = `
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #111; background: #fff; margin: 0; padding: 24px; font-size: 13px; }
  h1 { font-size: 22px; font-weight: 900; margin: 0 0 2px; }
  h2 { font-size: 14px; font-weight: 700; margin: 0 0 6px; text-transform: uppercase; letter-spacing: 0.08em; color: #444; }
  .badge { display: inline-block; background: #e5e7eb; border-radius: 9999px; padding: 2px 12px; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; }
  .badge-shift { background: #dbeafe; color: #1d4ed8; }
  .badge-daily { background: #d1fae5; color: #065f46; }
  .divider { border: none; border-top: 1px solid #e5e7eb; margin: 16px 0; }
  .divider-bold { border: none; border-top: 2px solid #111; margin: 12px 0; }
  .row { display: flex; justify-content: space-between; align-items: center; padding: 5px 0; }
  .label { color: #6b7280; font-weight: 500; }
  .value { font-weight: 800; }
  .value-big { font-size: 18px; font-weight: 900; }
  .value-green { color: #059669; }
  .value-red { color: #dc2626; }
  .section { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px 16px; margin-bottom: 12px; }
  .section-header { font-size: 11px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: #9ca3af; margin-bottom: 8px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { text-align: left; font-weight: 700; color: #9ca3af; font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; padding: 6px 8px; border-bottom: 1px solid #e5e7eb; }
  td { padding: 5px 8px; border-bottom: 1px solid #f3f4f6; }
  .text-right { text-align: right; }
  @media print { body { padding: 0; } }
`

/**
 * Generate and print a Shift Close (Cierre de Turno) report
 */
export function printShiftCloseReport({ session, cut, orders = [], expenses = [], closerName, restaurantName }) {
    const openedAt = session?.opened_at ? new Date(session.opened_at) : null
    const closedAt = new Date()

    const totalSales = parseFloat(cut?.total_amount || 0)
    const totalCash = parseFloat(cut?.total_cash || 0)
    const totalCard = parseFloat(cut?.total_card || 0)
    const totalTransfer = parseFloat(cut?.total_transfer || 0)
    const totalExpenses = expenses.reduce((s, g) => s + parseFloat(g.monto || 0), 0)
    const montoReal = parseFloat(cut?.monto_real || 0)
    const diferencia = parseFloat(cut?.diferencia || 0)

    const ordersHtml = orders.length > 0 ? `
      <table>
        <thead><tr>
          <th>Hora</th><th>Cliente</th><th>Tipo</th><th>Pago</th><th class="text-right">Total</th>
        </tr></thead>
        <tbody>
          ${orders.map(o => `
            <tr>
              <td>${new Date(o.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</td>
              <td>${o.customer_name || 'Cliente'}</td>
              <td>${o.order_type || 'Comer aquí'}</td>
              <td>${o.payment_method === 'cash' ? 'Efectivo' : o.payment_method === 'card' ? 'Tarjeta' : 'Transf.'}</td>
              <td class="text-right">${formatCurrency(o.total)}</td>
            </tr>`).join('')}
        </tbody>
      </table>` : '<p style="color:#9ca3af;font-style:italic">Sin órdenes en este turno.</p>'

    const expensesHtml = expenses.length > 0 ? `
      <table>
        <thead><tr><th>Descripción</th><th>Categoría</th><th class="text-right">Monto</th></tr></thead>
        <tbody>
          ${expenses.map(g => `
            <tr>
              <td>${g.descripcion || 'Sin descripción'}</td>
              <td>${g.categoria || ''}</td>
              <td class="text-right" style="color:#dc2626">-${formatCurrency(g.monto)}</td>
            </tr>`).join('')}
        </tbody>
      </table>` : '<p style="color:#9ca3af;font-style:italic">Sin gastos en este turno.</p>'

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Cierre de Turno</title><style>${baseStyles}</style></head><body>
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px">
        <div>
          <h1>${restaurantName || 'Restaurante'}</h1>
          <p style="color:#6b7280;margin:0;font-size:12px">Cierre de Turno — Reporte Oficial</p>
        </div>
        <div class="badge badge-shift">Corte Parcial</div>
      </div>
      <div class="section">
        <div class="section-header">Información del Turno</div>
        <div class="row"><span class="label">Cajero:</span><span class="value">${closerName || 'Administrador'}</span></div>
        <div class="row"><span class="label">Apertura:</span><span class="value">${openedAt ? openedAt.toLocaleString('es-MX') : '—'}</span></div>
        <div class="row"><span class="label">Cierre:</span><span class="value">${closedAt.toLocaleString('es-MX')}</span></div>
        <div class="row"><span class="label">Órdenes:</span><span class="value">${orders.length}</span></div>
      </div>
      <div class="section">
        <div class="section-header">Resumen de Ventas</div>
        <div class="row"><span class="label">Efectivo:</span><span class="value value-green">${formatCurrency(totalCash)}</span></div>
        <div class="row"><span class="label">Tarjeta:</span><span class="value">${formatCurrency(totalCard)}</span></div>
        <div class="row"><span class="label">Transferencia:</span><span class="value">${formatCurrency(totalTransfer)}</span></div>
        <hr class="divider">
        <div class="row"><span class="label" style="font-weight:800">Total Ventas:</span><span class="value-big">${formatCurrency(totalSales)}</span></div>
        ${totalExpenses > 0 ? `<div class="row"><span class="label">Gastos (−):</span><span class="value value-red">-${formatCurrency(totalExpenses)}</span></div>` : ''}
        <div class="row"><span class="label" style="font-weight:800">Neto Turno:</span><span class="value-big ${(totalSales - totalExpenses) >= 0 ? 'value-green' : 'value-red'}">${formatCurrency(totalSales - totalExpenses)}</span></div>
      </div>
      <div class="section">
        <div class="section-header">Auditoría de Efectivo</div>
        <div class="row"><span class="label">Efectivo esperado:</span><span class="value">${formatCurrency(parseFloat(cut?.monto_esperado || 0))}</span></div>
        <div class="row"><span class="label">Efectivo declarado:</span><span class="value">${formatCurrency(montoReal)}</span></div>
        <div class="row"><span class="label">Diferencia:</span><span class="value ${diferencia < 0 ? 'value-red' : 'value-green'}">${diferencia >= 0 ? '+' : ''}${formatCurrency(diferencia)}</span></div>
      </div>
      <h2>Detalle de Órdenes</h2>
      ${ordersHtml}
      <hr class="divider">
      <h2>Detalle de Gastos</h2>
      ${expensesHtml}
      <hr class="divider">
      <p style="text-align:center;color:#9ca3af;font-size:10px;margin-top:24px">Generado por GourmetClick · ${new Date().toLocaleString('es-MX')}</p>
    </body></html>`

    printHtml(html)
}

/**
 * Generate and print a Daily Close (Cierre Total del Día) report
 */
export function printDailyCloseReport({ restaurantName, dailyClose, shiftCuts, expenses = [] }) {
    const date = new Date().toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

    const shiftsHtml = shiftCuts.map((cut, i) => `
      <div class="section" style="margin-bottom:8px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <span style="font-weight:800;font-size:13px">Turno ${i + 1} · ${cut.closed_by_name || 'Cajero'}</span>
          <span class="badge badge-shift">Cerrado</span>
        </div>
        <div class="row"><span class="label">Hora cierre:</span><span class="value">${new Date(cut.cut_date || cut.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</span></div>
        <div class="row"><span class="label">Órdenes:</span><span class="value">${cut.order_count || 0}</span></div>
        <div class="row"><span class="label">Efectivo:</span><span class="value">${formatCurrency(cut.total_cash || 0)}</span></div>
        <div class="row"><span class="label">Tarjeta:</span><span class="value">${formatCurrency(cut.total_card || 0)}</span></div>
        <div class="row"><span class="label">Transferencia:</span><span class="value">${formatCurrency(cut.total_transfer || 0)}</span></div>
        <div class="row" style="border-top:1px solid #e5e7eb;margin-top:6px;padding-top:6px">
          <span class="label" style="font-weight:800">Subtotal Turno:</span>
          <span class="value value-green">${formatCurrency(cut.total_amount || 0)}</span>
        </div>
      </div>`).join('')

    const expensesHtml = expenses.length > 0 ? `
      <table>
        <thead><tr><th>Hora</th><th>Descripción</th><th>Categoría</th><th class="text-right">Monto</th></tr></thead>
        <tbody>
          ${expenses.map(g => `
            <tr>
              <td>${new Date(g.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</td>
              <td>${g.descripcion || 'Sin descripción'}</td>
              <td>${g.categoria || ''}</td>
              <td class="text-right value-red">-${formatCurrency(g.monto)}</td>
            </tr>`).join('')}
        </tbody>
      </table>` : '<p style="color:#9ca3af;font-style:italic">Sin gastos registrados hoy.</p>'

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Cierre Total del Día</title><style>${baseStyles}</style></head><body>
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px">
        <div>
          <h1>${restaurantName || 'Restaurante'}</h1>
          <p style="color:#6b7280;margin:0;font-size:12px">Cierre Total del Día — Reporte Oficial</p>
          <p style="color:#374151;margin:4px 0 0;font-size:13px;font-weight:700;text-transform:capitalize">${date}</p>
        </div>
        <div class="badge badge-daily">Cierre Total</div>
      </div>
      <div class="section" style="background:#f0fdf4;border-color:#bbf7d0">
        <div class="section-header" style="color:#065f46">Resumen del Día</div>
        <div class="row"><span class="label">Turnos cerrados:</span><span class="value">${dailyClose?.total_shifts || shiftCuts.length}</span></div>
        <div class="row"><span class="label">Ventas Brutas:</span><span class="value value-big">${formatCurrency(dailyClose?.gross_sales || 0)}</span></div>
        <div class="row"><span class="label">Efectivo total:</span><span class="value">${formatCurrency(dailyClose?.total_cash || 0)}</span></div>
        <div class="row"><span class="label">Tarjeta total:</span><span class="value">${formatCurrency(dailyClose?.total_card || 0)}</span></div>
        <div class="row"><span class="label">Transferencia total:</span><span class="value">${formatCurrency(dailyClose?.total_transfer || 0)}</span></div>
        <div class="row"><span class="label">Gastos totales:</span><span class="value value-red">-${formatCurrency(dailyClose?.total_expenses || 0)}</span></div>
        <hr class="divider-bold">
        <div class="row"><span style="font-weight:900;font-size:15px">BENEFICIO NETO:</span><span class="value-big ${(dailyClose?.net_amount || 0) >= 0 ? 'value-green' : 'value-red'}">${formatCurrency(dailyClose?.net_amount || 0)}</span></div>
      </div>
      <h2>Desglose por Turno</h2>
      ${shiftsHtml}
      <h2>Gastos del Día</h2>
      ${expensesHtml}
      <p style="text-align:center;color:#9ca3af;font-size:10px;margin-top:24px">Cierre efectuado por: ${dailyClose?.closed_by_name || 'Administrador'} · GourmetClick · ${new Date().toLocaleString('es-MX')}</p>
    </body></html>`

    printHtml(html)
}
