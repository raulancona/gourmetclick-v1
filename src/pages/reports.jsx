import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../features/auth/auth-context'
import { useTenant } from '../features/auth/tenant-context'
import { getSessionsHistory } from '../lib/order-service'
import { formatCurrency } from '../lib/utils'
import {
    Loader2, TrendingUp, TrendingDown, CheckCircle2,
    Clock, User, Shield, Download, PieChart,
    DollarSign, ShoppingBag, Receipt
} from 'lucide-react'
import { Button } from '../components/ui/button'
import { CortesHistory } from '../features/cash-closing/cortes-history'

export function ReportsPage() {
    const { user } = useAuth()
    const { tenant } = useTenant()

    const { data: history = [], isLoading } = useQuery({
        queryKey: ['sessions-history', tenant?.id],
        queryFn: () => getSessionsHistory(tenant.id),
        enabled: !!tenant?.id
    })

    const closedSessions = history.filter(s => s.estado === 'cerrada')

    // KPI Calculations
    const totalRevenue = closedSessions.reduce((sum, s) => {
        const expected = parseFloat(s.monto_esperado || 0);
        const fund = parseFloat(s.fondo_inicial || 0);
        return sum + (expected - fund);
    }, 0)

    const totalExpenses = closedSessions.reduce((sum, s) => {
        // Here we'd ideally have total_gastos in the session record, 
        // for now we infer it from (fondo + ventas - esperado) if not stored.
        // But since we want precision, let's assume we'll add total_expenses to the session model or fetch separately.
        // For now, let's use the provided difference logic or a placeholder if needed.
        return sum + parseFloat(s.total_gastos || 0)
    }, 0)

    const avgTicket = closedSessions.length > 0 ? totalRevenue / closedSessions.length : 0
    const totalDiff = closedSessions.reduce((sum, s) => sum + parseFloat(s.diferencia || 0), 0)

    const handleExportCSV = () => {
        if (closedSessions.length === 0) return

        // Headers
        const headers = ["ID Sesion", "Fecha Apertura", "Fecha Cierre", "Cajero", "Fondo Inicial", "Ventas Esperadas", "Monto Real", "Diferencia", "Gastos"]

        // Data rows
        const rows = closedSessions.map(s => [
            s.id.slice(0, 8),
            new Date(s.opened_at).toLocaleString(),
            new Date(s.closed_at).toLocaleString(),
            s.nombre_cajero || (s.empleado?.nombre) || 'N/A',
            s.fondo_inicial,
            s.monto_esperado,
            s.monto_real,
            s.diferencia,
            s.total_gastos || 0
        ])

        const csvContent = [headers, ...rows]
            .map(e => e.join(","))
            .join("\n")

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement("a")
        link.setAttribute("href", url)
        link.setAttribute("download", `reporte_ventas_${new Date().toISOString().split('T')[0]}.csv`)
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    if (isLoading) {
        return <div className="p-8 flex items-center justify-center min-h-[400px]"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
    }

    return (
        <div className="p-4 sm:p-8 space-y-8 max-w-7xl mx-auto pb-20">
            {/* Header with Export Action */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-foreground flex items-center gap-2">
                        <PieChart className="w-8 h-8 text-primary" />
                        Dashboard de Reportes
                    </h1>
                    <p className="text-muted-foreground font-medium">Análisis de rendimiento, cierres de caja y salud financiera</p>
                </div>
                <Button
                    onClick={handleExportCSV}
                    disabled={closedSessions.length === 0}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl px-6 h-12 shadow-lg shadow-primary/20"
                >
                    <Download className="w-5 h-5 mr-2" />
                    Exportar Historial (CSV)
                </Button>
            </div>

            {/* Premium KPI Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-card border border-border rounded-3xl p-6 shadow-sm hover:shadow-md transition-shadow group">
                    <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <DollarSign className="w-5 h-5 text-primary" />
                    </div>
                    <p className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-1">Ingresos Netos</p>
                    <h3 className="text-3xl font-black text-foreground">{formatCurrency(totalRevenue)}</h3>
                    <div className="flex items-center gap-1 mt-2 text-[10px] font-bold text-green-500 bg-green-500/10 w-fit px-2 py-0.5 rounded-full">
                        <TrendingUp className="w-3 h-3" />
                        Acumulado Real
                    </div>
                </div>

                <div className="bg-card border border-border rounded-3xl p-6 shadow-sm hover:shadow-md transition-shadow group">
                    <div className="w-10 h-10 rounded-2xl bg-blue-500/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <ShoppingBag className="w-5 h-5 text-blue-500" />
                    </div>
                    <p className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-1">Órdenes Totales</p>
                    <h3 className="text-3xl font-black text-foreground">{closedSessions.length}</h3>
                    <p className="text-[10px] font-bold text-muted-foreground mt-2 flex items-center gap-1">
                        <Receipt className="w-3 h-3" />
                        Turnos cerrados hasta hoy
                    </p>
                </div>

                <div className="bg-card border border-border rounded-3xl p-6 shadow-sm hover:shadow-md transition-shadow group">
                    <div className="w-10 h-10 rounded-2xl bg-amber-500/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <TrendingUp className="w-5 h-5 text-amber-500" />
                    </div>
                    <p className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-1">Ticket Promedio</p>
                    <h3 className="text-3xl font-black text-foreground">{formatCurrency(avgTicket)}</h3>
                    <p className="text-[10px] font-bold text-muted-foreground mt-2">Venta media por turno</p>
                </div>

                <div className={`bg-card border rounded-3xl p-6 shadow-sm hover:shadow-md transition-shadow group ${totalDiff < 0 ? 'border-red-500/20' : 'border-border'}`}>
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform ${totalDiff < 0 ? 'bg-red-500/10' : 'bg-green-500/10'}`}>
                        {totalDiff < 0 ? <TrendingDown className="w-5 h-5 text-red-500" /> : <TrendingUp className="w-5 h-5 text-green-500" />}
                    </div>
                    <p className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-1">Diferencias (Efectivo)</p>
                    <h3 className={`text-3xl font-black ${totalDiff < 0 ? 'text-red-500' : 'text-green-500'}`}>
                        {totalDiff >= 0 ? '+' : ''}{formatCurrency(totalDiff)}
                    </h3>
                    <p className="text-[10px] font-bold text-muted-foreground mt-2">Total mermas/ajustes</p>
                </div>
            </div>

            {/* Audit Log / Sessions List */}
            <div className="space-y-4">
                <div className="flex items-center gap-2 px-2">
                    <Clock className="w-5 h-5 text-primary" />
                    <h2 className="text-xl font-bold text-foreground">Bitácora de Auditoría (Turnos)</h2>
                </div>
                <CortesHistory />
            </div>
        </div>
    )
}

