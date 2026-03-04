import { useState, useEffect, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../features/auth/auth-context'
import { useTenant } from '../features/auth/tenant-context'
import { getProductCount } from '../lib/product-service'
import { getOrders, updateOrderStatus, updateOrder, deleteOrder, ORDER_STATUSES } from '../lib/order-service'
import { getOrderStats, getSalesAnalytics } from '../lib/analytics-service'
import { supabase } from '../lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { OrderDetailModal } from '../features/orders/order-detail-modal'
import { KpiDrilldownModal } from '../components/kpi-drilldown-modal'
import { toast } from 'sonner'
import { formatCurrency } from '../lib/utils'
import { Button } from '../components/ui/button'


import {
    TrendingUp, TrendingDown,
    ShoppingBag, Package,
    Truck, Store, Armchair,
    BadgeDollarSign, CreditCard, Banknote,
    Clock, Tag, BarChart3, LineChart as LineChartIcon,
    Users, Lock, Receipt, Coins, PiggyBank, Coffee
} from 'lucide-react'
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    LineChart, Line, Legend
} from 'recharts'

export function DashboardPage() {
    const { user } = useAuth()
    const { tenant } = useTenant()
    // restaurantId: prefer tenant.id (accurate for multi-role), fallback to user.id
    const restaurantId = tenant?.id || user?.id
    const queryClient = useQueryClient()
    const [selectedOrder, setSelectedOrder] = useState(null)
    const [selectedKpi, setSelectedKpi] = useState(null)

    // Date Filtering Logic
    const [timeRange, setTimeRange] = useState('today')
    const [customStart, setCustomStart] = useState(() => {
        const d = new Date()
        d.setHours(0, 0, 0, 0)
        return d.toISOString().split('T')[0]
    })
    const [customEnd, setCustomEnd] = useState(() => new Date().toISOString().split('T')[0])

    const TIME_LABELS = {
        today: 'Hoy',
        yesterday: 'Ayer',
        '7d': '7 Días',
        '30d': '30 Días',
        month: 'Este Mes',
        '3m': '3 Meses',
        custom: 'Personalizado',
    }

    const { start: startDate, end: endDate } = useMemo(() => {
        if (timeRange === 'custom') {
            // Guard against invalid date string
            if (!customStart || !customEnd) {
                const now = new Date()
                return { start: now.toISOString(), end: now.toISOString() }
            }
            try {
                return {
                    start: new Date(customStart + 'T00:00:00').toISOString(),
                    end: new Date(customEnd + 'T23:59:59').toISOString()
                }
            } catch (e) {
                const now = new Date()
                return { start: now.toISOString(), end: now.toISOString() }
            }
        }
        const now = new Date()
        const end = now.toISOString()
        let start = new Date()

        switch (timeRange) {
            case 'today':
                start.setHours(0, 0, 0, 0)
                break
            case 'yesterday': {
                start.setDate(now.getDate() - 1)
                start.setHours(0, 0, 0, 0)
                const endYesterday = new Date()
                endYesterday.setDate(now.getDate() - 1)
                endYesterday.setHours(23, 59, 59, 999)
                return { start: start.toISOString(), end: endYesterday.toISOString() }
            }
            case '7d':
                start.setDate(now.getDate() - 7)
                break
            case '30d':
                start.setDate(now.getDate() - 30)
                break
            case 'month':
                start.setDate(1)
                start.setHours(0, 0, 0, 0)
                break
            case '3m':
                start.setMonth(now.getMonth() - 3)
                break
            default:
                start.setDate(now.getDate() - 7)
        }
        return { start: start.toISOString(), end }
    }, [timeRange, customStart, customEnd])

    // Fetch product count
    const { data: productCount = 0 } = useQuery({
        queryKey: ['productCount', user?.id],
        queryFn: () => getProductCount(user.id),
        enabled: !!user?.id
    })

    // Fetch order stats (Analytics Mode - Date Based)
    const { data: stats, isLoading: isLoadingStats } = useQuery({
        queryKey: ['order-stats-dashboard', restaurantId, timeRange, startDate, endDate],
        queryFn: () => getOrderStats(restaurantId, {
            filterByShift: false,
            startDate,
            endDate
        }),
        enabled: !!restaurantId,
        refetchInterval: 60_000,
    })

    // Fetch sales analytics (Analytics Mode - Date Based)
    const { data: analytics, isLoading: isLoadingAnalytics } = useQuery({
        queryKey: ['sales-analytics-dashboard', restaurantId, timeRange, startDate, endDate],
        queryFn: () => getSalesAnalytics(restaurantId, {
            filterByShift: false,
            startDate,
            endDate
        }),
        enabled: !!restaurantId,
        refetchInterval: 60_000,
    })

    // Fetch expenses for date range — for Utilidad Neta
    const { data: expenses = [] } = useQuery({
        queryKey: ['dashboard-gastos', restaurantId, timeRange, startDate, endDate],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('gastos')
                .select('monto, categoria, descripcion, created_at')
                .eq('restaurant_id', restaurantId)   // gastos uses restaurant_id
                .gte('created_at', startDate)
                .lte('created_at', endDate)
            if (error) throw error
            return data || []
        },
        enabled: !!restaurantId,
        refetchInterval: 60_000,
    })

    // Fetch recent orders for the dashboard view (Date Based) - always includes closed
    const { data: recentOrders = [] } = useQuery({
        queryKey: ['recent-orders-dashboard', restaurantId, timeRange, startDate, endDate],
        queryFn: async () => {
            const all = await getOrders(restaurantId, {
                includeClosed: true,
                startDate,
                endDate,
                page: 1,
                pageSize: 8
            })
            return all.data || []
        },
        enabled: !!restaurantId,
        refetchInterval: 60_000,
    })

    // Realtime Subscription
    useEffect(() => {
        if (!user?.id) return

        const channel = supabase
            .channel('dashboard_updates')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'orders',
                    filter: `restaurant_id=eq.${user.id}` // Using user (tenant) ID
                },
                (payload) => {
                    console.log('Realtime Order updated for Dashboard!', payload)
                    // Invalidate all pertinent queries
                    queryClient.invalidateQueries({ queryKey: ['order-stats-dashboard'] })
                    queryClient.invalidateQueries({ queryKey: ['sales-analytics-dashboard'] })
                    queryClient.invalidateQueries({ queryKey: ['recent-orders-dashboard'] })
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [user?.id, queryClient])

    const formatCurrency = (val) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val)

    const paymentIcons = {
        cash: { icon: Banknote, label: 'Efectivo', color: '#10B981' },
        card: { icon: CreditCard, label: 'Tarjeta', color: '#3B82F6' },
        transfer: { icon: CreditCard, label: 'Transf.', color: '#8B5CF6' }
    }

    if (isLoadingStats || isLoadingAnalytics) {
        return (
            <div className="p-8 flex items-center justify-center min-h-[400px]">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
        )
    }

    // Derived metrics
    const totalExpenses = expenses.reduce((sum, g) => sum + (parseFloat(g.monto) || 0), 0)
    const netProfit = (stats?.revenue || 0) - totalExpenses
    const avgTicket = analytics?.metrics?.averageTicket || 0
    const topPayment = stats?.topPayment ? paymentIcons[stats.topPayment] : null

    // Top products derived from analytics
    const topByQty = [...(analytics?.topProducts || [])]
        .sort((a, b) => (b.quantity || 0) - (a.quantity || 0))
        .slice(0, 5)
    const topByRevenue = [...(analytics?.topProducts || [])]
        .sort((a, b) => (b.revenue || 0) - (a.revenue || 0))
        .slice(0, 5)


    return (
        <div className="p-4 sm:p-8 pb-16 space-y-6 max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-foreground mb-1">Resumen del Negocio</h1>
                    <p className="text-muted-foreground">Analítica detallada y estado histórico de tu restaurante</p>
                </div>

                {/* Date Filter Selector — presets + custom range */}
                <div className="flex flex-col gap-2 items-end">
                    <div className="flex flex-wrap items-center gap-1 bg-card p-1.5 rounded-2xl border border-border shadow-sm">
                        {[
                            { id: 'today', label: 'Hoy' },
                            { id: 'yesterday', label: 'Ayer' },
                            { id: '7d', label: '7 Días' },
                            { id: '30d', label: '30 Días' },
                            { id: 'month', label: 'Este Mes' },
                            { id: '3m', label: '3 Meses' },
                            { id: 'custom', label: '📅 Rango' },
                        ].map(range => (
                            <button
                                key={range.id}
                                onClick={() => setTimeRange(range.id)}
                                className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${timeRange === range.id
                                    ? 'bg-primary text-primary-foreground shadow-md'
                                    : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                                    }`}
                            >
                                {range.label}
                            </button>
                        ))}
                    </div>
                    {/* Custom date range inputs */}
                    {timeRange === 'custom' && (
                        <div className="flex items-center gap-2 bg-card p-2 rounded-2xl border border-border shadow-sm">
                            <div className="flex items-center gap-1">
                                <span className="text-[10px] font-black text-muted-foreground uppercase">Desde</span>
                                <input
                                    type="date"
                                    value={customStart}
                                    max={customEnd}
                                    onChange={e => setCustomStart(e.target.value)}
                                    className="text-xs font-bold border border-border rounded-lg px-2 py-1.5 bg-background text-foreground focus:ring-1 focus:ring-accent outline-none"
                                />
                            </div>
                            <span className="text-muted-foreground font-bold">→</span>
                            <div className="flex items-center gap-1">
                                <span className="text-[10px] font-black text-muted-foreground uppercase">Hasta</span>
                                <input
                                    type="date"
                                    value={customEnd}
                                    min={customStart}
                                    max={new Date().toISOString().split('T')[0]}
                                    onChange={e => setCustomEnd(e.target.value)}
                                    className="text-xs font-bold border border-border rounded-lg px-2 py-1.5 bg-background text-foreground focus:ring-1 focus:ring-accent outline-none"
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* KPI Strip — 5 cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {/* Ventas Brutas */}
                <div
                    onClick={() => setSelectedKpi({ type: 'ventas', label: 'Ventas Brutas', value: formatCurrency(stats?.revenue || 0), color: '#3B82F6', icon: TrendingUp })}
                    className="bg-secondary rounded-2xl shadow-md p-6 flex flex-col gap-2 cursor-pointer transition-all hover:-translate-y-1 hover:shadow-lg border border-secondary"
                >
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-primary/40 flex items-center justify-center">
                            <TrendingUp className="w-4 h-4 text-blue-400" />
                        </div>
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Ventas</span>
                    </div>
                    <div className="text-3xl font-black text-white tracking-tight mt-1">{formatCurrency(stats?.revenue || 0)}</div>
                    <p className="text-xs text-gray-400 font-medium">{stats?.delivered || 0} órdenes cobradas</p>
                </div>

                {/* Gastos */}
                <div
                    onClick={() => setSelectedKpi({ type: 'gastos', label: 'Gastos Registrados', value: formatCurrency(totalExpenses), color: '#F87171', icon: Receipt })}
                    className="bg-secondary rounded-2xl shadow-md p-6 flex flex-col gap-2 cursor-pointer transition-all hover:-translate-y-1 hover:shadow-lg border border-secondary"
                >
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-red-900/30 flex items-center justify-center">
                            <Receipt className="w-4 h-4 text-red-500" />
                        </div>
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Gastos</span>
                    </div>
                    <div className="text-3xl font-black text-red-500 tracking-tight mt-1">-{formatCurrency(totalExpenses)}</div>
                    <p className="text-xs text-gray-400 font-medium">{expenses.length} registros</p>
                </div>

                {/* Utilidad Neta — the key metric */}
                <div className={`rounded-2xl shadow-md p-6 flex flex-col gap-2 relative overflow-hidden ${netProfit >= 0
                    ? 'bg-emerald-50 border-2 border-emerald-500/30'
                    : 'bg-red-50 border-2 border-red-500/30'
                    }`}>
                    <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${netProfit >= 0 ? 'bg-emerald-200/50' : 'bg-red-200/50'
                            }`}>
                            <PiggyBank className={`w-4 h-4 ${netProfit >= 0 ? 'text-emerald-700' : 'text-red-600'}`} />
                        </div>
                        <span className={`text-[10px] font-black uppercase tracking-widest ${netProfit >= 0 ? 'text-emerald-700/60' : 'text-red-700/60'}`}>Utilidad Neta</span>
                    </div>
                    <div className={`text-3xl font-black tracking-tight mt-1 ${netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'
                        }`}>
                        {netProfit >= 0 ? '' : '-'}{formatCurrency(Math.abs(netProfit))}
                    </div>
                    <p className={`text-xs font-medium ${netProfit >= 0 ? 'text-emerald-800/70' : 'text-red-800/70'}`}>Ventas − Gastos registrados</p>
                    <p className={`text-[10px] italic mt-auto ${netProfit >= 0 ? 'text-emerald-800/50' : 'text-red-800/50'}`}>* No incluye costo de producto</p>
                </div>

                {/* Ticket Promedio */}
                <div className="bg-secondary rounded-2xl shadow-md p-6 flex flex-col gap-2 border border-secondary">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-amber-900/40 flex items-center justify-center">
                            <Coins className="w-4 h-4 text-accent" />
                        </div>
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Ticket Prom.</span>
                    </div>
                    <div className="text-3xl font-black text-white tracking-tight mt-1">{formatCurrency(avgTicket)}</div>
                    <p className="text-xs text-gray-400 font-medium">Por orden</p>
                </div>

                {/* Método Top */}
                <div
                    onClick={() => {
                        if (topPayment) setSelectedKpi({ type: 'metodo', label: `Cobros con ${topPayment.label}`, value: `${stats?.paymentMethods?.[stats.topPayment] || 0} órdenes`, color: '#8B5CF6', icon: BadgeDollarSign })
                    }}
                    className={`bg-secondary rounded-2xl shadow-md p-6 flex flex-col gap-2 border border-secondary ${topPayment ? 'cursor-pointer transition-all hover:-translate-y-1 hover:shadow-lg' : ''}`}
                >
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-violet-900/40 flex items-center justify-center">
                            <BadgeDollarSign className="w-4 h-4 text-violet-400" />
                        </div>
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Cobro Top</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                        {topPayment ? (
                            <>
                                <div className="p-1 rounded-md bg-white/10 flex items-center justify-center">
                                    <topPayment.icon className="w-5 h-5 text-emerald-400" />
                                </div>
                                <span className="text-2xl font-black text-white">{topPayment.label}</span>
                            </>
                        ) : (
                            <span className="text-2xl font-black text-gray-400">N/A</span>
                        )}
                    </div>
                    <p className="text-xs text-gray-400 font-medium mt-auto">Método frecuente</p>
                </div>
            </div>

            {/* Analytics Section - Charts */}
            <div className="grid gap-6 md:grid-cols-2">
                {/* Sales Trend Chart */}
                <Card className="shadow-sm border-border bg-card">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-foreground">
                            <LineChartIcon className="w-5 h-5 text-muted-foreground" />
                            Tendencia de Ventas
                        </CardTitle>
                        <CardDescription>Ingresos · {TIME_LABELS[timeRange]}</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px] flex items-center">
                        <ResponsiveContainer width="100%" height={280}>
                            <LineChart data={analytics?.salesTrend || []}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                                <XAxis
                                    dataKey="date"
                                    tickFormatter={(val) => new Date(val).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                    stroke="hsl(var(--muted-foreground))"
                                />
                                <YAxis
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={(val) => `$${val}`}
                                    stroke="hsl(var(--muted-foreground))"
                                />
                                <Tooltip
                                    formatter={(value) => formatCurrency(value)}
                                    labelFormatter={(label) => new Date(label).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}
                                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', color: 'hsl(var(--foreground))' }}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="revenue"
                                    stroke="#d4af37"
                                    strokeWidth={3}
                                    dot={{ r: 4, fill: "#d4af37" }}
                                    activeDot={{ r: 6 }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Top Products Chart */}
                <Card className="shadow-sm border-border bg-card">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-foreground">
                            <BarChart3 className="w-5 h-5 text-muted-foreground" />
                            Top 5 Productos
                        </CardTitle>
                        <CardDescription>Productos con mayores ingresos</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px] flex items-center">
                        <ResponsiveContainer width="100%" height={280}>
                            <BarChart data={analytics?.topProducts || []} layout="vertical" margin={{ left: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="hsl(var(--border))" />
                                <XAxis type="number" hide />
                                <YAxis
                                    dataKey="name"
                                    type="category"
                                    width={100}
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                    stroke="hsl(var(--muted-foreground))"
                                />
                                <Tooltip
                                    formatter={(value) => formatCurrency(value)}
                                    cursor={{ fill: 'transparent' }}
                                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', color: 'hsl(var(--foreground))' }}
                                />
                                <Bar dataKey="revenue" fill="#d4af37" radius={[0, 4, 4, 0]} barSize={20} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            {/* Secondary Metrics — Ticket Avg + Order Type Distribution */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Top 5 Más Vendidos */}
                <Card className="bg-card border-border shadow-sm">
                    <CardHeader className="pb-2 border-b border-border mb-4">
                        <CardTitle className="text-foreground text-sm flex items-center gap-2 font-black">
                            <Coffee className="w-4 h-4 text-muted-foreground" />
                            Más Vendidos
                        </CardTitle>
                        <CardDescription>Por cantidad de unidades</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {topByQty.length === 0 ? (
                            <p className="text-xs text-muted-foreground italic">Sin datos aún</p>
                        ) : (
                            <ol className="space-y-2">
                                {topByQty.map((p, i) => (
                                    <li key={p.name} className="flex items-center gap-2 text-sm">
                                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${i === 0 ? 'bg-amber-400 text-white' : i === 1 ? 'bg-gray-300 text-gray-700' : i === 2 ? 'bg-amber-700/40 text-amber-900' : 'bg-muted text-muted-foreground'
                                            }`}>{i + 1}</span>
                                        <span className="flex-1 font-medium text-foreground truncate">{p.name}</span>
                                        <span className="font-black text-orange-600 shrink-0">{p.quantity || 0}x</span>
                                    </li>
                                ))}
                            </ol>
                        )}
                    </CardContent>
                </Card>

                {/* Top 5 Más Rentables */}
                <Card className="bg-card border-border shadow-sm">
                    <CardHeader className="pb-2 border-b border-border mb-4">
                        <CardTitle className="text-foreground text-sm flex items-center gap-2 font-black">
                            <TrendingUp className="w-4 h-4 text-muted-foreground" />
                            Más Rentables
                        </CardTitle>
                        <CardDescription>Por ingresos generados</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {topByRevenue.length === 0 ? (
                            <p className="text-xs text-muted-foreground italic">Sin datos aún</p>
                        ) : (
                            <ol className="space-y-2">
                                {topByRevenue.map((p, i) => (
                                    <li key={p.name} className="flex items-center gap-2 text-sm">
                                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${i === 0 ? 'bg-blue-500 text-white' : i === 1 ? 'bg-blue-300 text-white' : i === 2 ? 'bg-blue-200 text-blue-800' : 'bg-muted text-muted-foreground'
                                            }`}>{i + 1}</span>
                                        <span className="flex-1 font-medium text-foreground truncate">{p.name}</span>
                                        <span className="font-black text-blue-600 shrink-0 text-xs">{formatCurrency(p.revenue || 0)}</span>
                                    </li>
                                ))}
                            </ol>
                        )}
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
                {/* Order Type Distribution */}
                <Card className="lg:col-span-3 border-border bg-card shadow-sm overflow-hidden">
                    <CardHeader>
                        <CardTitle className="text-lg text-foreground">Distribución de Ventas</CardTitle>
                        <CardDescription>Por tipo de servicio</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-5">
                            {[
                                { label: 'Delivery', value: stats?.orderTypes?.delivery || 0, icon: Truck, color: 'bg-blue-500', text: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20' },
                                { label: 'Pickup', value: stats?.orderTypes?.pickup || 0, icon: Store, color: 'bg-amber-500', text: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/20' },
                                { label: 'Dine-in', value: stats?.orderTypes?.dine_in || 0, icon: Armchair, color: 'bg-emerald-500', text: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
                            ].map((item, i) => {
                                const percentage = stats?.total > 0 ? (item.value / stats.total) * 100 : 0
                                return (
                                    <div key={i} className="group">
                                        <div className="flex items-center justify-between text-sm mb-2">
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2 rounded-lg bg-muted`}>
                                                    <item.icon className="w-4 h-4 text-foreground" />
                                                </div>
                                                <span className="font-bold text-foreground">{item.label}</span>
                                            </div>
                                            <div className="flex items-baseline gap-1">
                                                <span className="font-black text-lg text-foreground">{item.value}</span>
                                                <span className="text-[10px] text-muted-foreground">({Math.round(percentage)}%)</span>
                                            </div>
                                        </div>
                                        <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                                            <div
                                                className="h-full transition-all duration-1000 bg-accent"
                                                style={{ width: `${percentage}%` }}
                                            />
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </CardContent>
                </Card>

                {/* Recent Activity */}
                <Card className="lg:col-span-4 border-border bg-card shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-lg text-foreground">Órdenes Recientes</CardTitle>
                        <CardDescription>Últimos pedidos del sistema</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {recentOrders.length === 0 ? (
                            <div className="py-8 text-center text-muted-foreground italic">No hay actividad reciente</div>
                        ) : (
                            <div className="space-y-3">
                                {recentOrders.map(order => (
                                    <div
                                        key={order.id}
                                        className="group relative flex items-center justify-between p-3 rounded-xl hover:bg-muted/50 transition-all border border-transparent hover:border-border cursor-pointer"
                                        onClick={() => setSelectedOrder(order)}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={`
                                                w-10 h-10 rounded-full flex items-center justify-center shrink-0 border
                                                ${order.status === 'delivered' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                                    order.status === 'cancelled' ? 'bg-red-50 text-red-600 border-red-100' :
                                                        'bg-primary/5 text-primary border-primary/10'}
                                            `}>
                                                {order.order_type === 'delivery' ? <Truck className="w-5 h-5" /> :
                                                    order.order_type === 'dine_in' ? <Armchair className="w-5 h-5" /> :
                                                        <Store className="w-5 h-5" />}
                                            </div>
                                            <div>
                                                <p className="font-bold text-sm text-foreground group-hover:text-primary transition-colors">
                                                    {order.customer_name || 'Cliente General'}
                                                </p>
                                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                    <span>{new Date(order.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</span>
                                                    <span>•</span>
                                                    <span>{order.quantity || (order.items?.length || 0)} ítems</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="text-right">
                                            <p className="font-black text-sm">{formatCurrency(order.total)}</p>
                                            <span className={`
                                                inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase mt-1 text-white shadow-sm
                                                ${order.status === 'delivered' ? 'bg-emerald-600 border border-emerald-700' :
                                                    order.status === 'pending' ? 'bg-amber-600 border border-amber-700' :
                                                        order.status === 'getting_ready' || order.status === 'preparing' ? 'bg-purple-600 border border-purple-700' :
                                                            order.status === 'cancelled' ? 'bg-red-600 border border-red-700' :
                                                                'bg-blue-600 border border-blue-700'}
                                            `}>
                                                {ORDER_STATUSES[order.status]?.label || order.status}
                                            </span>
                                            {order.status === 'delivered' && !order.cash_cut_id && (
                                                <div className="flex items-center justify-end gap-1 mt-1">
                                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-[9px] font-bold border border-amber-200">
                                                        <Lock className="w-2.5 h-2.5 mr-0.5" /> Por Cortar
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {
                selectedOrder && (
                    <OrderDetailModal
                        order={selectedOrder}
                        onClose={() => setSelectedOrder(null)}
                        onUpdateStatus={async (status) => {
                            try {
                                await updateOrderStatus(selectedOrder.id, status, user.id)
                                toast.success('Estado actualizado')
                                setSelectedOrder({ ...selectedOrder, status })
                                queryClient.invalidateQueries(['orders'])
                            } catch (err) {
                                toast.error('Error al actualizar')
                            }
                        }}
                        onUpdateOrder={async (updates) => {
                            try {
                                await updateOrder(selectedOrder.id, updates, user.id)
                                toast.success('Orden actualizada')
                                setSelectedOrder({ ...selectedOrder, ...updates })
                                queryClient.invalidateQueries(['orders'])
                            } catch (err) {
                                toast.error('Error al actualizar')
                            }
                        }}
                        onDelete={async () => {
                            try {
                                await deleteOrder(selectedOrder.id, user.id)
                                toast.success('Orden eliminada')
                                setSelectedOrder(null)
                                queryClient.invalidateQueries(['orders'])
                            } catch (err) {
                                toast.error('Error al eliminar')
                            }
                        }}
                    />
                )
            }

            {/* KPI Detail Modal */}
            <KpiDrilldownModal
                isOpen={!!selectedKpi}
                onClose={() => setSelectedKpi(null)}
                kpi={selectedKpi}
                queryKey={['kpi-modal-dashboard', restaurantId, selectedKpi?.label, timeRange, startDate, endDate]}
                fetchFn={async (page, pageSize) => {
                    if (selectedKpi?.type === 'gastos') {
                        const from = (page - 1) * pageSize
                        const to = from + pageSize - 1
                        const { data, count, error } = await supabase
                            .from('gastos')
                            .select('*', { count: 'exact' })
                            .eq('restaurant_id', restaurantId)
                            .gte('created_at', startDate)
                            .lte('created_at', endDate)
                            .order('created_at', { ascending: false })
                            .range(from, to)
                        if (error) throw error
                        return { data: data || [], count: count || 0 }
                    }

                    // For 'ventas' or 'metodo' (orders)
                    let paymentMethod = null
                    if (selectedKpi?.type === 'metodo') {
                        paymentMethod = stats?.topPayment
                    }

                    return await getOrders(restaurantId, {
                        includeClosed: true,
                        startDate,
                        endDate,
                        page,
                        pageSize,
                        statuses: ['delivered'],
                        paymentMethod
                    })
                }}
                renderItem={(item) => {
                    if (selectedKpi?.type === 'gastos') {
                        return (
                            <div key={item.id} className="flex justify-between items-center p-4 bg-card rounded-xl border border-border">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-500">
                                        <Receipt className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="font-bold">{item.categoria}</p>
                                        <p className="text-sm text-muted-foreground">{item.descripcion || 'Sin descripción'}</p>
                                        <p className="text-xs text-muted-foreground font-medium flex items-center gap-1 mt-1">
                                            <Clock className="w-3 h-3" />
                                            {new Date(item.created_at).toLocaleDateString()} {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </div>
                                </div>
                                <span className="font-black text-red-500 text-lg">-{formatCurrency(item.monto)}</span>
                            </div>
                        )
                    }

                    // Defaults to rendering an Order
                    return (
                        <div key={item.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-border/60 hover:border-primary/40 bg-card transition-colors gap-3">
                            <div>
                                <p className="font-bold flex items-center gap-2">
                                    {item.customer_name || 'Cliente General'}
                                    <span className="text-[10px] font-mono font-bold opacity-60 bg-muted px-1.5 py-0.5 rounded">#{String(item.id).slice(0, 6)}</span>
                                </p>
                                <p className="text-sm text-foreground my-1 font-medium text-muted-foreground">
                                    <span className="font-bold text-foreground">Estado:</span> {ORDER_STATUSES[item.status]?.label || item.status}
                                </p>
                                <p className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
                                    <Clock className="w-3.5 h-3.5" />
                                    {new Date(item.created_at).toLocaleDateString()} {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </p>
                            </div>
                            <div className="text-right flex items-center gap-4">
                                <p className="font-black text-lg text-primary">{formatCurrency(item.total)}</p>
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    className="h-8 text-xs font-bold"
                                    onClick={() => {
                                        setSelectedKpi(null)
                                        setSelectedOrder(item)
                                    }}
                                >
                                    Ver Orden
                                </Button>
                            </div>
                        </div>
                    )
                }}
            />
        </div >
    )
}

