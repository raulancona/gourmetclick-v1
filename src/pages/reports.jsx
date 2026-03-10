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
    const { tenant, currentEmployee, user } = useTenant()
    const isAdmin = currentEmployee?.rol === 'admin' || currentEmployee?.rol === 'gerente' || !currentEmployee
    const [includeOpen, setIncludeOpen] = useState(false)

    const [dateRange, setDateRange] = useState(() => {
        const end = new Date()
        end.setHours(23, 59, 59, 999)
        const start = new Date()
        start.setDate(start.getDate() - 7)
        start.setHours(0, 0, 0, 0)
        return { start, end, label: 'Últimos 7 días' }
    })

    const [activeTab, setActiveTab] = useState('sales')

    const { data: summary, isLoading: loadingSummary } = useQuery({
        queryKey: ['reports-executive-summary', tenant?.id, dateRange.start, dateRange.end, includeOpen],
        queryFn: () => getExecutiveSummary(tenant.id, dateRange.start, dateRange.end, includeOpen),
        enabled: !!tenant?.id
    })

    const tabs = [
        { id: 'sales', label: 'Ventas', icon: TrendingUp, gradient: 'from-indigo-600 to-blue-600' },
        { id: 'expenses', label: 'Gastos', icon: ReceiptText, gradient: 'from-red-500 to-rose-600' },
        { id: 'audits', label: 'Auditoría de Caja', icon: Wallet, gradient: 'from-emerald-500 to-teal-600' },
    ]

    const netProfit = summary?.netProfit || 0

    return (
        <div className="p-4 sm:p-8 space-y-6 max-w-7xl mx-auto pb-20">
            {/* Header & Date Picker */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
                            <LayoutDashboard className="w-5 h-5 text-white" />
                        </div>
                        <h1 className="text-3xl font-black tracking-tight text-foreground">Panel de Reportes</h1>
                    </div>
                    <p className="text-muted-foreground font-medium mt-1 ml-1">Visión financiera interactiva</p>
                </div>

                <div className="w-full md:w-auto flex flex-col items-end gap-3">
                    <div>
                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest pl-1 mb-1 block text-right">Filtro de Fecha</label>
                        <DateRangePicker dateRange={dateRange} onChange={setDateRange} />
                    </div>
                    <div className="flex items-center gap-2 bg-muted/30 px-3 py-2 rounded-xl border border-border">
                        <input
                            type="checkbox"
                            id="includeOpen"
                            checked={includeOpen}
                            onChange={e => setIncludeOpen(e.target.checked)}
                            className="rounded text-primary focus:ring-primary w-4 h-4 bg-background border-border"
                        />
                        <label htmlFor="includeOpen" className="text-xs font-bold text-foreground cursor-pointer select-none">
                            Incluir ventas en curso (Caja abierta)
                        </label>
                    </div>
                </div>
            </div>

            {/* Executive Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Ingresos */}
                <div className="bg-gradient-to-br from-indigo-600 to-blue-700 rounded-3xl p-6 shadow-lg shadow-indigo-500/25 relative overflow-hidden border border-indigo-500/20">
                    <div className="absolute top-4 right-4 w-12 h-12 bg-white/15 rounded-2xl flex items-center justify-center">
                        <TrendingUp className="w-6 h-6 text-white" />
                    </div>
                    <p className="text-[10px] font-black text-indigo-200 uppercase tracking-widest mb-3">Ingresos (Ventas)</p>
                    {loadingSummary ? (
                        <div className="h-8 w-32 bg-white/20 animate-pulse rounded-lg" />
                    ) : (
                        <p className="text-3xl font-black text-white">{formatCurrency(summary?.totalSales)}</p>
                    )}
                </div>

                {/* Egresos */}
                <div className="bg-gradient-to-br from-rose-500 to-red-600 rounded-3xl p-6 shadow-lg shadow-red-500/25 relative overflow-hidden border border-red-500/20">
                    <div className="absolute top-4 right-4 w-12 h-12 bg-white/15 rounded-2xl flex items-center justify-center">
                        <TrendingDown className="w-6 h-6 text-white" />
                    </div>
                    <p className="text-[10px] font-black text-red-100 uppercase tracking-widest mb-3">Egresos (Gastos)</p>
                    {loadingSummary ? (
                        <div className="h-8 w-32 bg-white/20 animate-pulse rounded-lg" />
                    ) : (
                        <p className="text-3xl font-black text-white">{formatCurrency(summary?.totalExpenses)}</p>
                    )}
                </div>

                {/* Beneficio Neto */}
                <div className={`rounded-3xl p-6 shadow-lg relative overflow-hidden border ${netProfit >= 0
                    ? 'bg-gradient-to-br from-emerald-500 to-teal-600 shadow-emerald-500/25 border-emerald-500/20'
                    : 'bg-gradient-to-br from-red-500 to-rose-600 shadow-red-500/25 border-red-500/20'
                    }`}>
                    <div className="absolute top-4 right-4 w-12 h-12 bg-white/15 rounded-2xl flex items-center justify-center">
                        <PiggyBank className="w-6 h-6 text-white" />
                    </div>
                    <p className="text-[10px] font-black text-white/70 uppercase tracking-widest mb-3 cursor-help" title="Ventas Entregadas menos Gastos Operativos">
                        Beneficio Neto Estimado
                    </p>
                    {loadingSummary ? (
                        <div className="h-8 w-32 bg-white/20 animate-pulse rounded-lg" />
                    ) : (
                        <p className="text-3xl font-black text-white">{formatCurrency(summary?.netProfit)}</p>
                    )}
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex overflow-x-auto gap-2 p-1 bg-muted/40 rounded-2xl border border-border/50">
                {tabs.map(tab => {
                    const Icon = tab.icon
                    const isActive = activeTab === tab.id
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${isActive
                                ? `bg-gradient-to-r ${tab.gradient} text-white shadow-md`
                                : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                                }`}
                        >
                            <Icon className="w-4 h-4" /> {tab.label}
                        </button>
                    )
                })}
            </div>

            {/* Tab Content */}
            <div className="mt-8">
                {activeTab === 'sales' && <SalesTab tenantId={tenant?.id} dateRange={dateRange} includeOpen={includeOpen} isAdmin={isAdmin} />}
                {activeTab === 'expenses' && <ExpensesTab tenantId={tenant?.id} dateRange={dateRange} isAdmin={isAdmin} />}
                {activeTab === 'audits' && <AuditTab tenantId={tenant?.id} dateRange={dateRange} isAdmin={isAdmin} />}
            </div>
        </div>
    )
}

