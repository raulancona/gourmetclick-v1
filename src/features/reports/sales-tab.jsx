import { useQuery } from '@tanstack/react-query'
import { getSalesAnalytics } from '../../lib/reports-service'
import { exportSalesCSV } from '../../lib/reports-export'
import { formatCurrency } from '../../lib/utils'
import { Loader2, TrendingUp, Receipt, Download, AlertCircle } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts'

export function SalesTab({ tenantId, dateRange }) {
    const { data, isLoading, error } = useQuery({
        queryKey: ['reports-sales', tenantId, dateRange.start, dateRange.end],
        queryFn: () => getSalesAnalytics(tenantId, dateRange.start, dateRange.end),
        enabled: !!tenantId
    })

    if (isLoading) {
        return <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
    }

    if (error) {
        return <div className="p-12 text-center text-red-500 flex flex-col items-center"><AlertCircle className="w-8 h-8 mb-2" /> Error al cargar ventas</div>
    }

    const { kpis, chartData, deliveredOrders, rawOrders } = data

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Action Bar */}
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-black text-foreground">Análisis de Ventas</h3>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => exportSalesCSV(rawOrders, dateRange.label)}
                    disabled={rawOrders.length === 0}
                    className="font-bold border-primary/20 hover:bg-primary/10 text-primary"
                >
                    <Download className="w-4 h-4 mr-2" />
                    Exportar Detalles
                </Button>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-card p-5 rounded-2xl border border-border shadow-sm">
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1 flex items-center gap-1"><TrendingUp className="w-3 h-3 text-emerald-500" /> Ingresos Entregados</p>
                    <p className="text-2xl font-black text-foreground">{formatCurrency(kpis.totalRevenue)}</p>
                </div>
                <div className="bg-card p-5 rounded-2xl border border-border shadow-sm">
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1 flex items-center gap-1"><Receipt className="w-3 h-3 text-primary" /> Ticket Promedio</p>
                    <p className="text-2xl font-black text-foreground">{formatCurrency(kpis.ticketPromedio)}</p>
                </div>
                <div className="bg-card p-5 rounded-2xl border border-border shadow-sm">
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Órdenes Entregadas</p>
                    <p className="text-2xl font-black text-foreground">{kpis.deliveredCount}</p>
                </div>
                <div className="bg-card p-5 rounded-2xl border border-border shadow-sm">
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1 text-red-500/80">Órdenes Canceladas</p>
                    <p className="text-2xl font-black text-red-500">{kpis.cancelledCount}</p>
                </div>
            </div>

            {/* Chart */}
            <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
                <h4 className="text-sm font-black text-foreground mb-6">Tendencia de Ingresos</h4>
                <div className="h-[300px] w-full">
                    {chartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#d4af37" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#d4af37" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                                <XAxis
                                    dataKey="date"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                                    dy={10}
                                    tickFormatter={(val) => {
                                        const [y, m, d] = val.split('-');
                                        return `${d}/${m}`;
                                    }}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                                    tickFormatter={(val) => `$${val}`}
                                />
                                <Tooltip
                                    contentStyle={{ borderRadius: '12px', border: '1px solid hsl(var(--border))', backgroundColor: 'hsl(var(--card))', color: 'hsl(var(--foreground))', fontWeight: 'bold' }}
                                    formatter={(value) => [formatCurrency(value), 'Ingreso']}
                                    labelFormatter={(label) => `Fecha: ${label}`}
                                />
                                <Area type="monotone" dataKey="total" stroke="#d4af37" strokeWidth={3} fillOpacity={1} fill="url(#colorTotal)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm font-medium">
                            No hay datos suficientes para graficar.
                        </div>
                    )}
                </div>
            </div>

            {/* Table */}
            <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
                <div className="p-5 border-b border-border/50">
                    <h4 className="text-sm font-black text-foreground">Detalle de Órdenes</h4>
                </div>
                {rawOrders.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-[10px] text-muted-foreground uppercase tracking-wider bg-muted/50">
                                <tr>
                                    <th className="px-6 py-3 font-black">Folio</th>
                                    <th className="px-6 py-3 font-black">Fecha</th>
                                    <th className="px-6 py-3 font-black">Cliente</th>
                                    <th className="px-6 py-3 font-black">Método</th>
                                    <th className="px-6 py-3 font-black">Estado</th>
                                    <th className="px-6 py-3 font-black text-right">Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/50">
                                {rawOrders.map(order => (
                                    <tr key={order.id} className="hover:bg-muted/20">
                                        <td className="px-6 py-4 font-bold text-foreground">#{order.folio}</td>
                                        <td className="px-6 py-4 text-muted-foreground whitespace-nowrap">
                                            {new Date(order.created_at).toLocaleDateString('es-MX')} <br />
                                            <span className="text-xs">{new Date(order.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</span>
                                        </td>
                                        <td className="px-6 py-4 font-medium">{order.customer_name || 'General'}</td>
                                        <td className="px-6 py-4">
                                            <span className="bg-muted px-2 py-1 rounded-md text-xs font-bold uppercase">
                                                {order.payment_method || 'N/A'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded-md text-xs font-bold uppercase ${order.status === 'delivered' ? 'bg-emerald-100 text-emerald-700' :
                                                    order.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                                                        'bg-blue-100 text-blue-700'
                                                }`}>
                                                {order.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 font-black text-right">{formatCurrency(order.total)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="p-8 text-center text-muted-foreground text-sm font-medium">No hay órdenes en este período.</div>
                )}
            </div>
        </div>
    )
}
