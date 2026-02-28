import { useState, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getSessionsHistory, getOrderStats } from '../../lib/order-service'
import { useAuth } from '../auth/auth-context'
import { useTenant } from '../auth/tenant-context'
import { formatCurrency } from '../../lib/utils'
import { TrendingUp, TrendingDown, CheckCircle2, Calendar, User, Clock, Shield, ChevronLeft, ChevronRight } from 'lucide-react'
import { SessionDetailModal } from './session-detail-modal'
import { useVirtualizer } from '@tanstack/react-virtual'

export function CortesHistory() {
    const { user } = useAuth()
    const { tenant } = useTenant()
    const [selectedSession, setSelectedSession] = useState(null)
    const [page, setPage] = useState(1)
    const pageSize = 50

    const { data: historyData, isLoading } = useQuery({
        queryKey: ['sessions-history', tenant?.id, page],
        queryFn: () => getSessionsHistory(tenant.id, { page, pageSize }),
        enabled: !!tenant?.id
    })

    const history = historyData?.data || []
    const totalCount = historyData?.count || 0
    const totalPages = Math.ceil(totalCount / pageSize)

    const activeSession = history.find(s => s.estado === 'abierta')

    const parentRef = useRef(null)

    // Fetch active session current total to avoid "Calculando..."
    const { data: activeStats } = useQuery({
        queryKey: ['active-session-stats', tenant?.id, activeSession?.id],
        queryFn: () => getOrderStats(tenant.id, { sessionId: activeSession.id }),
        enabled: !!tenant?.id && !!activeSession,
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
                    <div ref={parentRef} className="h-[calc(100vh-250px)] min-h-[400px] overflow-y-auto pr-2 custom-scrollbar relative">
                        <VirtualSessionsList
                            sessions={history}
                            setSelectedSession={setSelectedSession}
                            activeStats={activeStats}
                            parentRef={parentRef}
                        />
                    </div>
                )}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between bg-card border rounded-2xl p-4 mt-6">
                    <p className="text-sm font-bold text-muted-foreground">
                        Mostrando {((page - 1) * pageSize) + 1} a {Math.min(page * pageSize, totalCount)} de <span className="text-foreground">{totalCount}</span>
                    </p>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="p-2 border rounded-xl hover:bg-muted disabled:opacity-50 transition-colors"
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        <span className="text-sm font-black px-4">{page} / {totalPages}</span>
                        <button
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages}
                            className="p-2 border rounded-xl hover:bg-muted disabled:opacity-50 transition-colors"
                        >
                            <ChevronRight className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            )}

            {selectedSession && (
                <SessionDetailModal
                    session={selectedSession}
                    onClose={() => setSelectedSession(null)}
                />
            )}
        </div>
    )
}

function VirtualSessionsList({ sessions, setSelectedSession, activeStats, parentRef }) {
    const rowVirtualizer = useVirtualizer({
        count: sessions.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 100, // Approximate height of each session card
        overscan: 5,
    })

    return (
        <div
            style={{
                height: `${rowVirtualizer.getTotalSize()}px`,
                width: '100%',
                position: 'relative',
            }}
        >
            {rowVirtualizer.getVirtualItems().map((virtualItem) => {
                const session = sessions[virtualItem.index]
                const isClosed = session.estado === 'cerrada'
                const isMissing = isClosed && session.diferencia < 0
                const isPerfect = isClosed && session.diferencia === 0
                const isSurplus = isClosed && session.diferencia > 0
                const isOpen = session.estado === 'abierta'

                return (
                    <div
                        key={virtualItem.key}
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: `${virtualItem.size}px`,
                            transform: `translateY(${virtualItem.start}px)`,
                            paddingBottom: '16px' // Gap 
                        }}
                    >
                        <div
                            onClick={() => setSelectedSession(session)}
                            className={`bg-card border rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all cursor-pointer hover:scale-[1.01] h-full ${isOpen ? 'border-primary ring-1 ring-primary/20' : 'border-border'}`}
                        >
                            <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-6 h-full">
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
                                                {(() => {
                                                    const raw = isClosed
                                                        ? (session.nombre_cajero || session.empleado?.nombre || '')
                                                        : (session.empleado?.nombre || session.nombre_cajero || '')
                                                    // If it's an email, show username part before @
                                                    const name = raw.includes('@') ? raw.split('@')[0] : raw
                                                    return name || 'Administrador'
                                                })()}
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
                    </div>
                )
            })}
        </div>
    )
}
