import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getSessionsHistory, getOrderStats } from '../../lib/order-service'
import { useAuth } from '../auth/auth-context'
import { formatCurrency } from '../../lib/utils'
import { TrendingUp, TrendingDown, CheckCircle2, Calendar, User, Clock, Shield } from 'lucide-react'
import { SessionDetailModal } from './session-detail-modal'

export function CortesHistory() {
    const { user } = useAuth()
    const [selectedSession, setSelectedSession] = useState(null)
    const { data: history = [], isLoading } = useQuery({
        queryKey: ['sessions-history', user?.id],
        queryFn: () => getSessionsHistory(user.id),
        enabled: !!user?.id
    })

    // Fetch active session current total to avoid "Calculando..."
    const { data: activeStats } = useQuery({
        queryKey: ['active-session-stats', user?.id],
        queryFn: () => getOrderStats(user.id, { filterByShift: true }), // Current open session stats
        enabled: !!user?.id && history.some(s => s.estado === 'abierta'),
        refetchInterval: 30000 // Update every 30s
    })

    if (isLoading) return <div className="text-center py-12 text-muted-foreground animate-pulse font-medium">Cargando historial de cortes...</div>

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between mb-2">
                <div>
                    <h2 className="text-xl font-black text-foreground">Historial de Cortes</h2>
                    <p className="text-xs text-muted-foreground font-bold uppercase tracking-tight">Registro de auditoría financiera</p>
                </div>
            </div>

            <div className="grid gap-4">
                {history.length === 0 ? (
                    <div className="text-center py-20 bg-muted/20 border border-dashed border-border rounded-3xl">
                        <CheckCircle2 className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-20" />
                        <p className="text-sm font-bold text-muted-foreground">No hay sesiones registradas aún</p>
                    </div>
                ) : (
                    history.map(session => {
                        const isClosed = session.estado === 'cerrada'
                        const isMissing = isClosed && session.diferencia < 0
                        const isPerfect = isClosed && session.diferencia === 0
                        const isSurplus = isClosed && session.diferencia > 0
                        const isOpen = session.estado === 'abierta'

                        return (
                            <div
                                key={session.id}
                                onClick={() => setSelectedSession(session)}
                                className={`bg-card border rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all cursor-pointer hover:scale-[1.01] ${isOpen ? 'border-primary ring-1 ring-primary/20' : 'border-border'}`}
                            >
                                <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-6">
                                    {/* Date and Info */}
                                    <div className="flex items-start gap-4">
                                        <div className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center shrink-0 ${isOpen ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                                            <span className={`text-[10px] font-black leading-none uppercase ${isOpen ? 'opacity-90' : 'opacity-40'}`}>
                                                {new Date(session.opened_at).toLocaleDateString('es-MX', { month: 'short' })}
                                            </span>
                                            <span className="text-lg font-black leading-none">{new Date(session.opened_at).getDate()}</span>
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <h4 className="font-black text-sm uppercase tracking-tight">Turno de Caja</h4>
                                                {isOpen ? (
                                                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full uppercase bg-blue-500 text-white animate-pulse">
                                                        En Curso (Abierto)
                                                    </span>
                                                ) : (
                                                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${isMissing ? 'bg-red-100 text-red-600' :
                                                        isSurplus ? 'bg-green-100 text-green-600' :
                                                            'bg-blue-100 text-blue-600'
                                                        }`}>
                                                        {isMissing ? 'Faltante' : isSurplus ? 'Sobrante' : 'Cuadre Perfecto'}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-3 text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
                                                <span className="flex items-center gap-1">
                                                    <Clock className="w-3 h-3" />
                                                    {new Date(session.opened_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    {session.closed_at && ` - ${new Date(session.closed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <User className="w-3 h-3" />
                                                    {isClosed ? (session.nombre_cajero || 'Admin') : (session.empleado?.nombre || 'Admin')}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Amounts Grid */}
                                    <div className="grid grid-cols-3 gap-8 flex-1 max-w-lg">
                                        <div>
                                            <p className="text-[9px] font-black text-muted-foreground uppercase mb-1">Fondo Inicial</p>
                                            <p className="text-sm font-bold">{formatCurrency(session.fondo_inicial)}</p>
                                        </div>
                                        <div>
                                            <p className="text-[9px] font-black text-muted-foreground uppercase mb-1">{isOpen ? 'Monto Actual' : 'Esperado'}</p>
                                            <p className="text-sm font-bold text-foreground">
                                                {isOpen ? formatCurrency(parseFloat(session.fondo_inicial) + (activeStats?.revenue || 0)) : formatCurrency(session.monto_esperado)}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[9px] font-black text-muted-foreground uppercase mb-1">{isOpen ? 'Estado' : 'Diferencia'}</p>
                                            {isOpen ? (
                                                <div className="text-sm font-black text-primary flex items-center justify-end gap-1">
                                                    <Shield className="w-3.5 h-3.5" /> Activo
                                                </div>
                                            ) : (
                                                <div className={`flex items-center justify-end gap-1 text-sm font-black ${isMissing ? 'text-red-600' :
                                                    isSurplus ? 'text-green-600' :
                                                        'text-primary'
                                                    }`}>
                                                    {isMissing ? <TrendingDown className="w-4 h-4" /> : isSurplus ? <TrendingUp className="w-4 h-4" /> : null}
                                                    {formatCurrency(session.diferencia)}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )
                    })
                )}
            </div>

            {selectedSession && (
                <SessionDetailModal
                    session={selectedSession}
                    onClose={() => setSelectedSession(null)}
                />
            )}
        </div>
    )
}
