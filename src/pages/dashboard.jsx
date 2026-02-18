import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../features/auth/auth-context'
import { getProductCount } from '../lib/product-service'
import { getOrderStats, getOrders, getSalesAnalytics } from '../lib/order-service'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
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
    const [timeRange, setTimeRange] = useState('7d')

    // Fetch product count
    const { data: productCount = 0 } = useQuery({
        queryKey: ['productCount', user?.id],
        queryFn: () => getProductCount(user.id),
        enabled: !!user?.id
    })

    // Fetch order stats
    const { data: stats, isLoading: isLoadingStats } = useQuery({
        queryKey: ['order-stats', user?.id],
        queryFn: () => getOrderStats(user.id),
        enabled: !!user?.id
    })

    // Fetch sales analytics
    const { data: analytics, isLoading: isLoadingAnalytics } = useQuery({
        queryKey: ['sales-analytics', user?.id],
        queryFn: () => getSalesAnalytics(user.id),
        enabled: !!user?.id
    })

    // Fetch recent orders for the dashboard view
    const { data: recentOrders = [] } = useQuery({
        queryKey: ['recent-orders', user?.id],
        queryFn: async () => {
            const all = await getOrders(user.id)
            return all.slice(0, 5)
        },
        enabled: !!user?.id
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
        <div className="p-8 pb-16 space-y-8 max-w-7xl mx-auto">
            <div>
                <h1 className="text-3xl font-black tracking-tight text-foreground mb-1">Resumen del Negocio</h1>
                <p className="text-muted-foreground">Analítica detallada y estado actual de tu restaurante</p>
            </div>

            {/* Main Metrics */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {/* ... existing cards ... */}
                <Card className="border-none shadow-sm bg-blue-50/50 dark:bg-blue-900/20">
                    <CardHeader className="pb-2">
                        <CardDescription className="text-blue-600 dark:text-blue-400 font-semibold flex items-center gap-2">
                            <TrendingUp className="w-4 h-4" /> Ventas Totales
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black text-blue-900 dark:text-blue-100">{formatCurrency(stats?.revenue || 0)}</div>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-sm bg-orange-50/50 dark:bg-orange-900/20">
                    <CardHeader className="pb-2">
                        <CardDescription className="text-orange-600 dark:text-orange-400 font-semibold flex items-center gap-2">
                            <ShoppingBag className="w-4 h-4" /> Órdenes Totales
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black text-orange-900 dark:text-orange-100">{stats?.total || 0}</div>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-sm bg-purple-50/50 dark:bg-purple-900/20">
                    <CardHeader className="pb-2">
                        <CardDescription className="text-purple-600 dark:text-purple-400 font-semibold flex items-center gap-2">
                            <Package className="w-4 h-4" /> Productos
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black text-purple-900 dark:text-purple-100">{productCount}</div>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-sm bg-green-50/50 dark:bg-green-900/20">
                    <CardHeader className="pb-2">
                        <CardDescription className="text-green-600 dark:text-green-400 font-semibold flex items-center gap-2">
                            <BadgeDollarSign className="w-4 h-4" /> Cobro más utilizado
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-2">
                            {topPayment ? (
                                <>
                                    <topPayment.icon className="w-6 h-6" style={{ color: topPayment.color }} />
                                    <div className="text-2xl font-black text-green-900 dark:text-green-100">{topPayment.label}</div>
                                </>
                            ) : (
                                <div className="text-2xl font-black text-muted-foreground">N/A</div>
                            )}
                        </div>
                    </CardContent>
                </Card>
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
                        <CardDescription>Ingresos de los últimos 7 días</CardDescription>
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
            <div className="grid gap-6 md:grid-cols-3">
                <Card className="bg-emerald-50/50 border-emerald-100 dark:bg-emerald-900/20 dark:border-emerald-900/50">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-emerald-700 dark:text-emerald-400 text-lg flex items-center gap-2">
                            <Banknote className="w-5 h-5" />
                            Ticket Promedio
                        </CardTitle>
                        <CardDescription className="text-emerald-600/80 dark:text-emerald-400/80">Promedio por orden</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black text-emerald-900 dark:text-emerald-100 mb-1">
                            {formatCurrency(analytics?.metrics?.averageTicket || 0)}
                        </div>
                        <p className="text-xs text-emerald-700 dark:text-emerald-300 font-medium">Promedio de venta en órdenes completadas.</p>
                    </CardContent>
                </Card>

                <Card className="bg-blue-50/50 border-blue-100 dark:bg-blue-900/20 dark:border-blue-900/50">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-blue-700 dark:text-blue-400 text-lg flex items-center gap-2">
                            <Clock className="w-5 h-5" />
                            Tiempo de Preparación
                        </CardTitle>
                        <CardDescription className="text-blue-600/80 dark:text-blue-400/80">Promedio cocina &rarr; listo</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black text-blue-900 dark:text-blue-100 mb-1">
                            {analytics?.metrics?.preparationTime || 'N/A'}
                        </div>
                        <p className="text-xs text-blue-700 dark:text-blue-300 font-medium">Tiempo promedio de procesamiento.</p>
                    </CardContent>
                </Card>

                <Card className="bg-amber-50/50 border-amber-100 dark:bg-amber-900/20 dark:border-amber-900/50">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-amber-700 dark:text-amber-400 text-lg flex items-center gap-2">
                            <Users className="w-5 h-5" />
                            Clientes Recurrentes
                        </CardTitle>
                        <CardDescription className="text-amber-600/80 dark:text-amber-400/80">Fidelización</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black text-amber-900 dark:text-amber-100 mb-1">
                            {Math.round(analytics?.metrics?.recurringCustomersPercentage || 0)}%
                        </div>
                        <p className="text-xs text-amber-700 dark:text-amber-300 font-medium">Porcentaje de órdenes de clientes frecuentes.</p>
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
                                    <div key={order.id} className="py-3 flex items-center justify-between">
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
        </div>
    )
}
