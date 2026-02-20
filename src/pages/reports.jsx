import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../features/auth/auth-context'
import { getSessionsHistory } from '../lib/order-service'
import { formatCurrency } from '../lib/utils'
import { Loader2, TrendingUp, TrendingDown, CheckCircle2, Clock, User, Shield } from 'lucide-react'
import { CortesHistory } from '../features/cash-closing/cortes-history'

export function ReportsPage() {
    const { user } = useAuth()

    const { data: history = [], isLoading } = useQuery({
        queryKey: ['sessions-history', user?.id],
        queryFn: () => getSessionsHistory(user.id),
        enabled: !!user?.id
    })

    const closedSessions = history.filter(s => s.estado === 'cerrada')
    const totalRevenue = closedSessions.reduce((sum, s) => sum + parseFloat(s.monto_real || 0), 0)
    const avgRevenue = closedSessions.length > 0 ? totalRevenue / closedSessions.length : 0
    const totalDiff = closedSessions.reduce((sum, s) => sum + parseFloat(s.diferencia || 0), 0)

    if (isLoading) {
        return <div className="p-8 flex items-center justify-center min-h-[400px]"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
    }

    return (
        <div className="p-4 sm:p-8 space-y-8 max-w-7xl mx-auto pb-20">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-black tracking-tight text-foreground">Control de Cierres</h1>
                <p className="text-muted-foreground">Auditoría de caja · Historial de turnos y cuadres financieros</p>
            </div>

            {/* Summary KPIs */}
            {closedSessions.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-1">
                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Total Acumulado</p>
                        <p className="text-2xl font-black text-primary">{formatCurrency(totalRevenue)}</p>
                        <p className="text-xs text-muted-foreground">{closedSessions.length} turnos cerrados</p>
                    </div>
                    <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-1">
                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Promedio por Turno</p>
                        <p className="text-2xl font-black text-foreground">{formatCurrency(avgRevenue)}</p>
                        <p className="text-xs text-muted-foreground">Ingreso promedio histórico</p>
                    </div>
                    <div className={`bg-card border rounded-2xl p-5 flex flex-col gap-1 ${totalDiff < 0 ? 'border-red-500/30' : totalDiff > 0 ? 'border-green-500/30' : 'border-border'}`}>
                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Diferencia Total</p>
                        <p className={`text-2xl font-black ${totalDiff < 0 ? 'text-red-500' : totalDiff > 0 ? 'text-green-500' : 'text-foreground'}`}>
                            {totalDiff >= 0 ? '+' : ''}{formatCurrency(totalDiff)}
                        </p>
                        <p className="text-xs text-muted-foreground">Desviación acumulada de efectivo</p>
                    </div>
                </div>
            )}

            {/* History using the premium CortesHistory component */}
            <CortesHistory />
        </div>
    )
}
