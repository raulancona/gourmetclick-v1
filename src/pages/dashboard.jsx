import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../features/auth/auth-context'
import { getProductCount } from '../lib/product-service'
import { getOrderStats, getOrders, getSalesAnalytics, updateOrderStatus, updateOrder, deleteOrder } from '../lib/order-service'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { OrderDetailModal } from '../features/orders/order-detail-modal'
import { toast } from 'sonner'
import { formatCurrency } from '../lib/utils'

import {
    TrendingUp,
    ShoppingBag,
    Package,
    Truck,
    Store,
    Armchair,
    BadgeDollarSign,
    CreditCard,
    Banknote,
    Clock,
    Tag,
    BarChart3,
    LineChart as LineChartIcon,
    Users
} from 'lucide-react'
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    LineChart, Line, Legend
} from 'recharts'

export function DashboardPage() {
    const { user } = useAuth()
    const queryClient = useQueryClient()
    const [selectedOrder, setSelectedOrder] = useState(null)

    // Date Filtering Logic
    const [timeRange, setTimeRange] = useState('today')

    const TIME_LABELS = {
        today: 'Hoy',
        yesterday: 'Ayer',
        '7d': 'Últimos 7 días',
        '30d': 'Últimos 30 días',
        month: 'Este mes',
        '3m': 'Últimos 3 meses',
    }

    const getDateRange = (range) => {
        const now = new Date()
        const end = now.toISOString()
        let start = new Date()

        switch (range) {
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
    }

    const { start: startDate, end: endDate } = getDateRange(timeRange)

    // Fetch product count
    const { data: productCount = 0 } = useQuery({
        queryKey: ['productCount', user?.id],
        queryFn: () => getProductCount(user.id),
        enabled: !!user?.id
    })

    // Fetch order stats (Analytics Mode - Date Based)
    const { data: stats, isLoading: isLoadingStats } = useQuery({
        queryKey: ['order-stats-dashboard', user?.id, timeRange],
        queryFn: () => getOrderStats(user.id, {
            filterByShift: false,
            startDate,
            endDate
        }),
        enabled: !!user?.id,
        refetchInterval: 60_000, // Auto-refresh every 60s
    })

    // Fetch sales analytics (Analytics Mode - Date Based)
    const { data: analytics, isLoading: isLoadingAnalytics } = useQuery({
        queryKey: ['sales-analytics-dashboard', user?.id, timeRange],
        queryFn: () => getSalesAnalytics(user.id, {
            filterByShift: false,
            startDate,
            endDate
        }),
        enabled: !!user?.id,
        refetchInterval: 60_000,
    })

    // Fetch recent orders for the dashboard view (Date Based) - always includes closed
    const { data: recentOrders = [] } = useQuery({
        queryKey: ['recent-orders-dashboard', user?.id, timeRange],
        queryFn: async () => {
            const all = await getOrders(user.id, {
                includeClosed: true,
                startDate,
                endDate
            })
            return all.slice(0, 8)
        },
        enabled: !!user?.id,
        refetchInterval: 60_000,
    })

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

    const topPayment = stats?.topPayment ? paymentIcons[stats.topPayment] : null

    // Prepare ABC Data for display
    const productsA = analytics?.abcAnalysis?.filter(p => p.category === 'A') || []
    const productsB = analytics?.abcAnalysis?.filter(p => p.category === 'B') || []
    const productsC = analytics?.abcAnalysis?.filter(p => p.category === 'C') || []

    return (
        <div className="p-4 sm:p-8 pb-16 space-y-6 max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-foreground mb-1">Resumen del Negocio</h1>
                    <p className="text-muted-foreground">Analítica detallada y estado histórico de tu restaurante</p>
                </div>

                {/* Date Filter Selector — improved with 6 ranges */}
                <div className="flex flex-wrap items-center gap-1 bg-white dark:bg-gray-800 p-1 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
                    {[
                        { id: 'today', label: 'Hoy' },
                        { id: 'yesterday', label: 'Ayer' },
                        { id: '7d', label: '7 Días' },
                        { id: '30d', label: '30 Días' },
                        { id: 'month', label: 'Este Mes' },
                        { id: '3m', label: '3 Meses' },
                    ].map(range => (
                        <button
                            key={range.id}
                            onClick={() => setTimeRange(range.id)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${timeRange === range.id
                                ? 'bg-primary text-white shadow-md'
                                : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'
                                }`}
                        >
                            {range.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Main Metrics — Left-accent border pattern for clean Dark/Light Mode */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Revenue */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 border-l-4 border-l-blue-500 shadow-sm p-6 flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                            <TrendingUp className="w-5 h-5 text-blue-500" />
                        </div>
                        <span className="text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Ventas Totales</span>
                    </div>
                    <div className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">{formatCurrency(stats?.revenue || 0)}</div>
                    <p className="text-xs text-gray-400 dark:text-gray-500">Órdenes entregadas en el periodo</p>
                </div>

                {/* Orders */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 border-l-4 border-l-orange-500 shadow-sm p-6 flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-xl bg-orange-50 dark:bg-orange-900/30 flex items-center justify-center">
                            <ShoppingBag className="w-5 h-5 text-orange-500" />
                        </div>
                        <span className="text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Órdenes</span>
                    </div>
                    <div className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">{stats?.total || 0}</div>
                    <p className="text-xs text-gray-400 dark:text-gray-500">{stats?.delivered || 0} entregadas · {stats?.cancelled || 0} canceladas</p>
                </div>

                {/* Products */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 border-l-4 border-l-purple-500 shadow-sm p-6 flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-900/30 flex items-center justify-center">
                            <Package className="w-5 h-5 text-purple-500" />
                        </div>
                        <span className="text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Productos</span>
                    </div>
                    <div className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">{productCount}</div>
                    <p className="text-xs text-gray-400 dark:text-gray-500">En tu catálogo activo</p>
                </div>

                {/* Top Payment */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 border-l-4 border-l-green-500 shadow-sm p-6 flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-xl bg-green-50 dark:bg-green-900/30 flex items-center justify-center">
                            <BadgeDollarSign className="w-5 h-5 text-green-500" />
                        </div>
                        <span className="text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Cobro Estelar</span>
                    </div>
                    <div className="flex items-center gap-3">
                        {topPayment ? (
                            <>
                                <topPayment.icon className="w-8 h-8" style={{ color: topPayment.color }} />
                                <span className="text-2xl font-black text-gray-900 dark:text-white">{topPayment.label}</span>
                            </>
                        ) : (
                            <span className="text-2xl font-black text-gray-400">N/A</span>
                        )}
                    </div>
                    <p className="text-xs text-gray-400 dark:text-gray-500">Método más frecuente</p>
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
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
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
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
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

            {/* Secondary Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-white dark:bg-gray-800 border-2 border-emerald-100 dark:border-emerald-900/50 shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-emerald-600 dark:text-emerald-400 text-lg flex items-center gap-2 uppercase text-[10px] tracking-widest font-black">
                            <Banknote className="w-5 h-5" />
                            Ticket Promedio
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black text-gray-900 dark:text-white mb-1">
                            {formatCurrency(analytics?.metrics?.averageTicket || 0)}
                        </div>
                        <p className="text-xs text-muted-foreground">Promedio histórico del periodo.</p>
                    </CardContent>
                </Card>

                <Card className="bg-white dark:bg-gray-800 border-2 border-blue-100 dark:border-blue-900/50 shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-blue-600 dark:text-blue-400 text-lg flex items-center gap-2 uppercase text-[10px] tracking-widest font-black">
                            <Clock className="w-5 h-5" />
                            Tiempo de Preparación
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black text-gray-900 dark:text-white mb-1">
                            {analytics?.metrics?.preparationTime || 'N/A'}
                        </div>
                        <p className="text-xs text-muted-foreground">Efectividad operativa.</p>
                    </CardContent>
                </Card>

                <Card className="bg-white dark:bg-gray-800 border-2 border-amber-100 dark:border-amber-900/50 shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-amber-600 dark:text-amber-400 text-lg flex items-center gap-2 uppercase text-[10px] tracking-widest font-black">
                            <Users className="w-5 h-5" />
                            Fidelización
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black text-gray-900 dark:text-white mb-1">
                            {Math.round(analytics?.metrics?.recurringCustomersPercentage || 0)}%
                        </div>
                        <p className="text-xs text-muted-foreground">Retorno de clientes.</p>
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
                        <div className="space-y-4">
                            {[
                                { label: 'A domicilio (Delivery)', value: stats?.orderTypes?.delivery || 0, icon: Truck, color: '#3B82F6' },
                                { label: 'Pasar a recoger (Pickup)', value: stats?.orderTypes?.pickup || 0, icon: Store, color: '#F59E0B' },
                                { label: 'Comer aquí (Dine-in)', value: stats?.orderTypes?.dine_in || 0, icon: Armchair, color: '#10B981' },
                            ].map((item, i) => {
                                const percentage = stats?.total > 0 ? (item.value / stats.total) * 100 : 0
                                return (
                                    <div key={i} className="space-y-1.5">
                                        <div className="flex items-center justify-between text-sm">
                                            <div className="flex items-center gap-2">
                                                <item.icon className="w-4 h-4" style={{ color: item.color }} />
                                                <span className="font-medium text-foreground">{item.label}</span>
                                            </div>
                                            <span className="font-black text-foreground">{item.value}</span>
                                        </div>
                                        <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                                            <div
                                                className="h-full transition-all duration-1000"
                                                style={{ width: `${percentage}%`, backgroundColor: item.color }}
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
                            <div className="divide-y divide-border">
                                {recentOrders.map(order => (
                                    <div
                                        key={order.id}
                                        className="py-3 flex items-center justify-between cursor-pointer hover:bg-muted/50 transition-colors px-2 -mx-2 rounded-xl"
                                        onClick={() => setSelectedOrder(order)}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                                                <Clock className="w-5 h-5 text-muted-foreground" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-foreground">{order.customer_name}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {order.order_type === 'delivery' ? '🛵 Envío' : order.order_type === 'dine_in' ? '🪑 Mesa' : '🏪 Recoger'}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm font-black text-foreground">{formatCurrency(order.total)}</p>
                                            <div className="mt-1">
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase transition-colors ${order.status === 'delivered' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                                    order.status === 'pending' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                                                        order.status === 'cancelled' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                                                            'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                                    }`}>
                                                    {order.status}
                                                </span>
                                            </div>
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
        </div >
    )
}

