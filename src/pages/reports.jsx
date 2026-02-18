import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../features/auth/auth-context'
import { getCashCuts, getOrderStats, getSalesAnalytics } from '../lib/order-service'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card'
import { Button } from '../components/ui/button'
import {
    Calendar, TrendingUp, ShoppingBag,
    Banknote, CreditCard, Landmark,
    ChevronRight, ChevronLeft, Loader2,
    FileText, Search
} from 'lucide-react'
import { formatCurrency } from '../lib/utils'
import { Modal } from '../components/ui/modal'

export function ReportsPage() {
    const { user } = useAuth()
    const [selectedCut, setSelectedCut] = useState(null)

    const { data: cuts = [], isLoading } = useQuery({
        queryKey: ['cash-cuts', user?.id],
        queryFn: () => getCashCuts(user.id),
        enabled: !!user?.id
    })

    if (isLoading) {
        return <div className="p-8 flex items-center justify-center min-h-[400px]"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
    }

    return (
        <div className="p-4 sm:p-8 space-y-8 max-w-7xl mx-auto pb-20">
            <div>
                <h1 className="text-3xl font-black tracking-tight text-foreground">Historial de Reportes</h1>
                <p className="text-muted-foreground">Consulta los cierres de caja anteriores y el rendimiento histórico.</p>
            </div>

            <div className="grid grid-cols-1 gap-6">
                <Card className="border-border shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-xl font-bold">Cortes Realizados</CardTitle>
                        <FileText className="w-5 h-5 text-muted-foreground" />
                    </CardHeader>
                    <CardContent className="pt-6">
                        <div className="rounded-xl border border-border overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="bg-muted/50 border-b border-border">
                                    <tr>
                                        <th className="px-4 py-3 text-left font-bold text-muted-foreground uppercase text-[10px] tracking-wider">Fecha</th>
                                        <th className="px-4 py-3 text-left font-bold text-muted-foreground uppercase text-[10px] tracking-wider">Órdenes</th>
                                        <th className="px-4 py-3 text-left font-bold text-muted-foreground uppercase text-[10px] tracking-wider hidden sm:table-cell">Efectivo</th>
                                        <th className="px-4 py-3 text-left font-bold text-muted-foreground uppercase text-[10px] tracking-wider hidden sm:table-cell">Tarjeta</th>
                                        <th className="px-4 py-3 text-left font-bold text-muted-foreground uppercase text-[10px] tracking-wider">Total</th>
                                        <th className="px-4 py-3 text-right"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {cuts.length === 0 ? (
                                        <tr>
                                            <td colSpan="6" className="px-4 py-12 text-center text-muted-foreground italic">
                                                No hay cortes registrados todavía.
                                            </td>
                                        </tr>
                                    ) : (
                                        cuts.map((cut) => (
                                            <tr key={cut.id} className="hover:bg-muted/30 transition-colors group">
                                                <td className="px-4 py-4">
                                                    <div className="flex flex-col">
                                                        <span className="font-black text-foreground text-sm">
                                                            {new Date(cut.cut_date).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })} • {new Date(cut.cut_date).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                        <span className="text-[10px] text-muted-foreground font-medium uppercase">
                                                            {new Date(cut.cut_date).toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric' })}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4">
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-bold">
                                                        <ShoppingBag className="w-3 h-3" />
                                                        {cut.order_count}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-4 hidden sm:table-cell font-medium text-emerald-600 dark:text-emerald-400">
                                                    {formatCurrency(cut.total_cash)}
                                                </td>
                                                <td className="px-4 py-4 hidden sm:table-cell font-medium text-blue-600 dark:text-blue-400">
                                                    {formatCurrency(cut.total_card)}
                                                </td>
                                                <td className="px-4 py-4">
                                                    <span className="font-black text-foreground">
                                                        {formatCurrency(cut.total_amount)}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-4 text-right">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="rounded-xl group-hover:bg-primary group-hover:text-primary-foreground transition-all"
                                                        onClick={() => setSelectedCut(cut)}
                                                    >
                                                        Detalles
                                                        <ChevronRight className="w-4 h-4 ml-1" />
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {selectedCut && (
                <DetailModal
                    cut={selectedCut}
                    onClose={() => setSelectedCut(null)}
                    userId={user.id}
                />
            )}
        </div>
    )
}

function DetailModal({ cut, onClose, userId }) {
    // Fetch analytics just for this cut
    const { data: stats, isLoading: loadingStats } = useQuery({
        queryKey: ['cash-cut-stats', cut.id],
        queryFn: () => getOrderStats(userId, { cashCutId: cut.id }),
        enabled: !!cut.id
    })

    const { data: analytics, isLoading: loadingAnalytics } = useQuery({
        queryKey: ['cash-cut-analytics', cut.id],
        queryFn: () => getSalesAnalytics(userId, { cashCutId: cut.id }),
        enabled: !!cut.id
    })

    return (
        <Modal
            isOpen={true}
            onClose={onClose}
            title={`Resumen del Corte - ${new Date(cut.cut_date).toLocaleDateString()}`}
            size="md"
        >
            <div className="space-y-6 pb-4">
                {/* Main KPIs */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10">
                        <p className="text-[10px] text-muted-foreground uppercase font-black mb-1">Total Ventas</p>
                        <p className="text-2xl font-black text-primary">{formatCurrency(cut.total_amount)}</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-muted/50 border border-border/50">
                        <p className="text-[10px] text-muted-foreground uppercase font-black mb-1">Tickets</p>
                        <p className="text-2xl font-black text-foreground">{cut.order_count}</p>
                    </div>
                </div>

                {/* Payments Breakdown */}
                <div className="space-y-3">
                    <h3 className="text-xs font-black text-muted-foreground uppercase tracking-widest">Desglose de Pagos</h3>
                    <div className="space-y-2">
                        <div className="flex items-center justify-between p-3 rounded-xl bg-muted/20 border border-border/30">
                            <div className="flex items-center gap-2">
                                <Banknote className="w-4 h-4 text-emerald-500" />
                                <span className="text-sm font-bold">Efectivo</span>
                            </div>
                            <span className="font-black">{formatCurrency(cut.total_cash)}</span>
                        </div>
                        <div className="flex items-center justify-between p-3 rounded-xl bg-muted/20 border border-border/30">
                            <div className="flex items-center gap-2">
                                <CreditCard className="w-4 h-4 text-blue-500" />
                                <span className="text-sm font-bold">Tarjeta</span>
                            </div>
                            <span className="font-black">{formatCurrency(cut.total_card)}</span>
                        </div>
                        <div className="flex items-center justify-between p-3 rounded-xl bg-muted/20 border border-border/30">
                            <div className="flex items-center gap-2">
                                <Landmark className="w-4 h-4 text-purple-500" />
                                <span className="text-sm font-bold">Transferencia</span>
                            </div>
                            <span className="font-black">{formatCurrency(cut.total_transfer)}</span>
                        </div>
                    </div>
                </div>

                {/* Top Products in this cut */}
                <div className="space-y-3">
                    <h3 className="text-xs font-black text-muted-foreground uppercase tracking-widest">Productos más vendidos</h3>
                    {loadingAnalytics ? (
                        <div className="flex justify-center p-4"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
                    ) : (
                        <div className="space-y-2">
                            {analytics?.topProducts?.map((product, i) => (
                                <div key={i} className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground">{product.name}</span>
                                    <span className="font-bold">{formatCurrency(product.revenue)}</span>
                                </div>
                            ))}
                            {(!analytics?.topProducts || analytics.topProducts.length === 0) && (
                                <p className="text-center text-xs text-muted-foreground italic py-2">No hay datos de productos.</p>
                            )}
                        </div>
                    )}
                </div>

                <div className="pt-4 border-t border-border flex justify-end">
                    <Button onClick={onClose} className="rounded-xl">
                        Cerrar reporte
                    </Button>
                </div>
            </div>
        </Modal>
    )
}
