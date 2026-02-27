import { useQuery } from '@tanstack/react-query'
import { getExpensesAnalytics } from '../../lib/reports-service'
import { exportExpensesCSV } from '../../lib/reports-export'
import { formatCurrency } from '../../lib/utils'
import { Loader2, Download, AlertCircle, PieChart } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { ResponsiveContainer, Tooltip, PieChart as RePieChart, Pie, Cell, Legend } from 'recharts'

const COLORS = ['#ef4444', '#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#ec4899', '#64748b'];

export function ExpensesTab({ tenantId, dateRange }) {
    const { data, isLoading, error } = useQuery({
        queryKey: ['reports-expenses', tenantId, dateRange.start, dateRange.end],
        queryFn: () => getExpensesAnalytics(tenantId, dateRange.start, dateRange.end),
        enabled: !!tenantId
    })

    if (isLoading) {
        return <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
    }

    if (error) {
        return <div className="p-12 text-center text-red-500 flex flex-col items-center"><AlertCircle className="w-8 h-8 mb-2" /> Error al cargar gastos</div>
    }

    const { totalGastos, rawExpenses, chartData } = data

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Action Bar */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-black text-foreground">Análisis de Gastos</h3>
                    <p className="text-sm font-bold text-red-500">Total: {formatCurrency(totalGastos)}</p>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => exportExpensesCSV(rawExpenses, dateRange.label)}
                    disabled={rawExpenses.length === 0}
                    className="font-bold border-primary/20 hover:bg-primary/10 text-primary"
                >
                    <Download className="w-4 h-4 mr-2" />
                    Exportar Detalles
                </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Chart Section */}
                <div className="bg-card border border-border rounded-2xl p-6 shadow-sm col-span-1 border-t-4 border-t-red-500">
                    <h4 className="text-sm font-black text-foreground mb-4 flex items-center gap-2"><PieChart className="w-4 h-4 text-red-500" /> Distribución por Categoría</h4>
                    <div className="h-[250px] w-full">
                        {chartData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <RePieChart>
                                    <Pie
                                        data={chartData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {chartData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        formatter={(value) => formatCurrency(value)}
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }}
                                    />
                                    <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '12px', fontWeight: 'bold' }} />
                                </RePieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs font-semibold">
                                No hay gastos registrados.
                            </div>
                        )}
                    </div>
                </div>

                {/* Table Section */}
                <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden col-span-1 lg:col-span-2">
                    <div className="p-5 border-b border-border/50">
                        <h4 className="text-sm font-black text-foreground">Historial de Gastos</h4>
                    </div>
                    {rawExpenses.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-[10px] text-muted-foreground uppercase tracking-wider bg-muted/50">
                                    <tr>
                                        <th className="px-6 py-3 font-black">Fecha</th>
                                        <th className="px-6 py-3 font-black">Categoría</th>
                                        <th className="px-6 py-3 font-black">Descripción</th>
                                        <th className="px-6 py-3 font-black text-right">Monto</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/50">
                                    {rawExpenses.map(expense => (
                                        <tr key={expense.id} className="hover:bg-muted/20">
                                            <td className="px-6 py-4 text-muted-foreground whitespace-nowrap">
                                                {new Date(expense.created_at).toLocaleDateString('es-MX')} <br />
                                                <span className="text-xs">{new Date(expense.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="bg-muted px-2 py-1 rounded-md text-xs font-bold uppercase border border-border">
                                                    {expense.categoria || 'Sin Categoría'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 font-medium max-w-[200px] truncate" title={expense.descripcion}>
                                                {expense.descripcion || '-'}
                                                <div className="text-[10px] text-muted-foreground mt-0.5 uppercase">Por: {expense.empleado?.nombre || 'Admin'}</div>
                                            </td>
                                            <td className="px-6 py-4 font-black text-right text-red-500">-{formatCurrency(expense.monto)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="p-8 text-center text-muted-foreground text-sm font-medium">No hay gastos en este período.</div>
                    )}
                </div>
            </div>
        </div>
    )
}
