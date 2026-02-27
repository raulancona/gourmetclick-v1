import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTenant } from '../features/auth/tenant-context'
import { getExecutiveSummary } from '../lib/reports-service'
import { formatCurrency } from '../lib/utils'
import { DateRangePicker } from '../components/ui/date-range-picker'
import { SalesTab } from '../features/reports/sales-tab'
import { ExpensesTab } from '../features/reports/expenses-tab'
import { AuditTab } from '../features/reports/audit-tab'
import { Loader2, TrendingUp, TrendingDown, LayoutDashboard, Wallet, PiggyBank, ReceiptText } from 'lucide-react'

export function ReportsPage() {
    const { tenant } = useTenant()

    // Default: Last 7 days
    const [dateRange, setDateRange] = useState(() => {
        const end = new Date()
        end.setHours(23, 59, 59, 999)
        const start = new Date()
        start.setDate(start.getDate() - 7)
        start.setHours(0, 0, 0, 0)
        return { start, end, label: 'Últimos 7 días' }
    })

    const [activeTab, setActiveTab] = useState('sales')

    // Executive Summary (Top Bar)
    const { data: summary, isLoading: loadingSummary } = useQuery({
        queryKey: ['reports-executive-summary', tenant?.id, dateRange.start, dateRange.end],
        queryFn: () => getExecutiveSummary(tenant.id, dateRange.start, dateRange.end),
        enabled: !!tenant?.id
    })

    return (
        <div className="p-4 sm:p-8 space-y-6 max-w-7xl mx-auto pb-20">
            {/* Header & Date Picker */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-foreground flex items-center gap-2">
                        <LayoutDashboard className="w-8 h-8 text-primary" />
                        Panel de Reportes
                    </h1>
                    <p className="text-muted-foreground font-medium mt-1">Visión financiera interactiva</p>
                </div>

                <div className="w-full md:w-auto">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest pl-1 mb-1 block">Filtro de Fecha</label>
                    <DateRangePicker
                        dateRange={dateRange}
                        onChange={setDateRange}
                    />
                </div>
            </div>

            {/* Executive Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-card border border-border rounded-3xl p-6 shadow-sm relative overflow-hidden group hover:border-emerald-500/30 transition-colors">
                    <div className="absolute top-4 right-4 w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center">
                        <TrendingUp className="w-6 h-6 text-emerald-500" />
                    </div>
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2">Ingresos (Ventas)</p>
                    {loadingSummary ? (
                        <div className="h-8 w-32 bg-muted animate-pulse rounded-lg"></div>
                    ) : (
                        <p className="text-3xl font-black text-foreground">{formatCurrency(summary?.totalSales)}</p>
                    )}
                </div>

                <div className="bg-card border border-border rounded-3xl p-6 shadow-sm relative overflow-hidden group hover:border-red-500/30 transition-colors">
                    <div className="absolute top-4 right-4 w-12 h-12 bg-red-500/10 rounded-2xl flex items-center justify-center">
                        <TrendingDown className="w-6 h-6 text-red-500" />
                    </div>
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2">Egresos (Gastos)</p>
                    {loadingSummary ? (
                        <div className="h-8 w-32 bg-muted animate-pulse rounded-lg"></div>
                    ) : (
                        <p className="text-3xl font-black text-foreground">{formatCurrency(summary?.totalExpenses)}</p>
                    )}
                </div>

                <div className="bg-primary border border-primary-foreground/10 xl:border-none rounded-3xl p-6 shadow-lg shadow-primary/20 relative overflow-hidden text-primary-foreground">
                    <div className="absolute top-4 right-4 w-12 h-12 bg-black/10 rounded-2xl flex items-center justify-center">
                        <PiggyBank className="w-6 h-6 text-white" />
                    </div>
                    <p className="text-[10px] font-black text-primary-foreground/80 uppercase tracking-widest mb-2 cursor-help" title="Ventas Entregadas menos Gastos Operativos">Beneficio Neto Estimado</p>
                    {loadingSummary ? (
                        <div className="h-8 w-32 bg-primary-foreground/10 animate-pulse rounded-lg"></div>
                    ) : (
                        <p className="text-3xl font-black text-white">{formatCurrency(summary?.netProfit)}</p>
                    )}
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex overflow-x-auto hide-scrollbar gap-2 p-1 bg-muted/40 rounded-2xl border border-border/50">
                <button
                    onClick={() => setActiveTab('sales')}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'sales' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-background/50'}`}
                >
                    <TrendingUp className="w-4 h-4" /> Ventas
                </button>
                <button
                    onClick={() => setActiveTab('expenses')}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'expenses' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-background/50'}`}
                >
                    <ReceiptText className="w-4 h-4" /> Gastos
                </button>
                <button
                    onClick={() => setActiveTab('audit')}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'audit' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-background/50'}`}
                >
                    <Wallet className="w-4 h-4" /> Auditoría de Caja
                </button>
            </div>

            {/* Tab Content */}
            <div className="mt-8">
                {activeTab === 'sales' && <SalesTab tenantId={tenant?.id} dateRange={dateRange} />}
                {activeTab === 'expenses' && <ExpensesTab tenantId={tenant?.id} dateRange={dateRange} />}
                {activeTab === 'audit' && <AuditTab tenantId={tenant?.id} dateRange={dateRange} />}
            </div>
        </div>
    )
}
