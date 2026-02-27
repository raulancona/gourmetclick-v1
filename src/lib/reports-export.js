import { formatCurrency } from './utils'

export function exportToCSV(filename, headers, rows) {
    const csvContent = [headers, ...rows]
        .map(e => e.map(item => {
            // Escape comillas y envolver en comillas dobles si hay comas o espacios
            const stringItem = String(item !== null && item !== undefined ? item : '');
            if (stringItem.includes(',') || stringItem.includes('"') || stringItem.includes('\n')) {
                return `"${stringItem.replace(/"/g, '""')}"`;
            }
            return stringItem;
        }).join(","))
        .join("\n");

    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

export function exportSalesCSV(orders, dateRangeStr) {
    const headers = ['Folio', 'Fecha', 'Hora', 'Estado', 'Subtotal', 'Propina', 'Total', 'Metodo Pago', 'Cliente'];

    const rows = orders.map(order => [
        order.folio,
        new Date(order.created_at).toLocaleDateString('es-MX'),
        new Date(order.created_at).toLocaleTimeString('es-MX'),
        order.status,
        order.subtotal,
        order.tip_amount,
        order.total,
        order.payment_method || 'Desconocido',
        order.customer_name || 'General'
    ]);

    exportToCSV(`Ventas_${dateRangeStr.replace(/\s/g, '_')}`, headers, rows);
}

export function exportExpensesCSV(expenses, dateRangeStr) {
    const headers = ['Fecha', 'Hora', 'Categoria', 'Descripcion', 'Monto', 'Registrado Por'];

    const rows = expenses.map(expense => [
        new Date(expense.created_at).toLocaleDateString('es-MX'),
        new Date(expense.created_at).toLocaleTimeString('es-MX'),
        expense.categoria || 'Sin Categoría',
        expense.descripcion,
        expense.monto,
        expense.empleado?.nombre || 'Administrador'
    ]);

    exportToCSV(`Gastos_${dateRangeStr.replace(/\s/g, '_')}`, headers, rows);
}

export function exportAuditCSV(cuts, dateRangeStr) {
    const headers = ['ID Sesion', 'Apertura', 'Cierre', 'Cajero', 'Fondo Inicial', 'Ingreso Físico Efectivo (Real)', 'Ingreso Sistema', 'Diferencia Mermas', 'Total Gastos Turno'];

    const rows = cuts.map(cut => [
        cut.id.substring(0, 8),
        new Date(cut.opened_at).toLocaleString('es-MX'),
        cut.closed_at ? new Date(cut.closed_at).toLocaleString('es-MX') : 'En Curso',
        cut.nombre_cajero || cut.empleado?.nombre || 'Administrador',
        cut.fondo_inicial,
        cut.monto_real,
        cut.monto_esperado,
        cut.diferencia,
        cut.total_gastos || 0
    ]);

    exportToCSV(`Auditoria_Caja_${dateRangeStr.replace(/\s/g, '_')}`, headers, rows);
}
