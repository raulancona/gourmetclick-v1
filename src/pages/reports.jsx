import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../features/auth/auth-context'
import { useTenant } from '../features/auth/tenant-context'
import { getSessionsHistory, getSalesAnalytics } from '../lib/order-service'
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

    const [activeTab, setActiveTab] = useState('analytics') // 'analytics' or 'audit'

    const { data: history = [], isLoading } = useQuery({
        queryKey: ['sessions-history', tenant?.id],
        queryFn: () => getSessionsHistory(tenant.id),
        enabled: !!tenant?.id
    })

    const { data: analytics, isLoading: analyticsLoading } = useQuery({
        queryKey: ['sales-analytics', tenant?.id],
        queryFn: () => getSalesAnalytics(tenant.id, {
            startDate: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString() // Last 30 days
        }),
        enabled: !!tenant?.id && activeTab === 'analytics'
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
        <div className="p-4 sm:p-8 space-y-6 max-w-7xl mx-auto pb-20">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-foreground flex items-center gap-2">
                        <PieChart className="w-8 h-8 text-primary" />
                        Reportes e Inteligencia
                    </h1>
                    <p className="text-muted-foreground font-medium">Gestiona tu negocio y audita tus finanzas</p>
                </div>
                {activeTab === 'audit' && (
                    <Button
                        onClick={handleExportCSV}
                        disabled={closedSessions.length === 0}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl px-6 h-12 shadow-lg shadow-primary/20"
                    >
                        <Download className="w-5 h-5 mr-2" />
                        Exportar Auditoría (CSV)
                    </Button>
                )}
            </div>

            {/* Tab Switcher */}
            <div className="flex p-1 bg-muted/50 rounded-2xl w-fit border border-border">
                <button
                    onClick={() => setActiveTab('analytics')}
                    className={`px-6 py-2.5 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all ${activeTab === 'analytics'
                        ? 'bg-card text-primary shadow-sm ring-1 ring-border'
                        : 'text-muted-foreground hover:text-foreground'
                        }`}
                >
                    Analíticas de Negocio
                </button>
                <button
                    onClick={() => setActiveTab('audit')}
                    className={`px-6 py-2.5 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all ${activeTab === 'audit'
                        ? 'bg-card text-primary shadow-sm ring-1 ring-border'
                        : 'text-muted-foreground hover:text-foreground'
                        }`}
                >
                    Auditoría de Caja
                </button>
            </div>

            {activeTab === 'analytics' ? (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    {/* Business Analytics View - Placeholder for now or direct order stats */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div className="bg-card border border-border rounded-3xl p-6 shadow-sm">
                            <div className="w-10 h-10 rounded-2xl bg-green-500/10 flex items-center justify-center mb-4 text-green-600">
                                <DollarSign className="w-5 h-5" />
                            </div>
                            <p className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-1">Ventas Reales</p>
                            <h3 className="text-3xl font-black text-foreground">
                                {analyticsLoading ? '...' : formatCurrency(analytics?.totalRevenue || 0)}
                            </h3>
                            <p className="text-[10px] font-bold text-muted-foreground mt-2">Últimos 30 días acumulados</p>
                        </div>
                        <div className="bg-card border border-border rounded-3xl p-6 shadow-sm">
                            <div className="w-10 h-10 rounded-2xl bg-blue-500/10 flex items-center justify-center mb-4 text-blue-600">
                                <ShoppingBag className="w-5 h-5" />
                            </div>
                            <p className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-1">Volumen de Órdenes</p>
                            <h3 className="text-3xl font-black text-foreground">
                                {analyticsLoading ? '...' : (analytics?.validOrdersCount || closedSessions.reduce((sum, s) => sum + (s.total_ordenes || 0), 0))}
                            </h3>
                            <p className="text-[10px] font-bold text-muted-foreground mt-2">Transacciones totales registradas</p>
                        </div>
                        <div className="bg-card border border-border rounded-3xl p-6 shadow-sm">
                            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 flex items-center justify-center mb-4 text-amber-600">
                                <TrendingUp className="w-5 h-5" />
                            </div>
                            <p className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-1">Ticket Promedio</p>
                            <h3 className="text-3xl font-black text-foreground">
                                {analyticsLoading ? '...' : formatCurrency(analytics?.metrics?.averageTicket || 0)}
                            </h3>
                            <p className="text-[10px] font-bold text-muted-foreground mt-2">Promedio por orden pagada</p>
                        </div>
                    </div>

                    <div className="bg-muted/30 border-2 border-dashed border-border rounded-3xl p-12 text-center">
                        <TrendingUp className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-20" />
                        <h3 className="font-bold text-foreground">Inteligencia de Negocio Avanzada</h3>
                        <p className="text-sm text-muted-foreground max-w-sm mx-auto">Muy pronto: Gráficas de tendencias diarias, productos más vendidos y mapas de calor de ventas por hora.</p>
                    </div>
                </div>
            ) : (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    {/* Audit Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-card border-l-4 border-amber-500 rounded-2xl p-6 shadow-sm">
                            <p className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-1">Monto en Caja (Declarado)</p>
                            <h3 className="text-2xl font-black text-foreground">
                                {formatCurrency(closedSessions.reduce((sum, s) => sum + parseFloat(s.monto_real || 0), 0))}
                            </h3>
                        </div>
                        <div className="bg-card border-l-4 border-red-500 rounded-2xl p-6 shadow-sm">
                            <p className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-1">Diferencia Total (Mermas)</p>
                            <h3 className={`text-2xl font-black ${totalDiff < 0 ? 'text-red-500' : 'text-green-500'}`}>
                                {totalDiff >= 0 ? '+' : ''}{formatCurrency(totalDiff)}
                            </h3>
                        </div>
                        <div className="bg-card border-l-4 border-primary rounded-2xl p-6 shadow-sm">
                            <p className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-1">Gastos Operativos</p>
                            <h3 className="text-2xl font-black text-foreground">{formatCurrency(totalExpenses)}</h3>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center gap-2 px-2">
                            <Clock className="w-5 h-5 text-primary" />
                            <h2 className="text-xl font-bold text-foreground">Bitácora de Auditoría (Turnos)</h2>
                        </div>
                        <CortesHistory />
                    </div>
                </div>
            )}
        </div>
    )
}

