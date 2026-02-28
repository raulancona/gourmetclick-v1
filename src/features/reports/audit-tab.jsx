import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getCashCutAnalytics } from '../../lib/reports-service'
import { exportAuditCSV } from '../../lib/reports-export'
import { formatCurrency } from '../../lib/utils'
import { Loader2, TrendingUp, TrendingDown, ClipboardList, Shield, Download, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '../../components/ui/button'

export function AuditTab({ tenantId, dateRange }) {
    const [page, setPage] = useState(1)
    const pageSize = 15

    const { data, isLoading, error } = useQuery({
        queryKey: ['reports-audit', tenantId, dateRange.start, dateRange.end],
        queryFn: () => getCashCutAnalytics(tenantId, dateRange.start, dateRange.end),
        enabled: !!tenantId
    })

    useEffect(() => {
        setPage(1)
    }, [dateRange.start, dateRange.end])

    if (isLoading) {
        return <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
    }

    if (error) {
        return <div className="p-12 text-center text-red-500 flex flex-col items-center"><AlertCircle className="w-8 h-8 mb-2" /> Error al cargar auditoría</div>
    }

    const { kpis, rawCuts } = data

    const totalPages = Math.ceil((rawCuts?.length || 0) / pageSize)
    const currentCuts = rawCuts ? rawCuts.slice((page - 1) * pageSize, page * pageSize) : []

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Action Bar */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-black text-foreground">Auditoría de Caja</h3>
                    <p className="text-sm font-medium text-muted-foreground">Turnos cerrados en este período</p>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => exportAuditCSV(rawCuts, dateRange.label)}
                    disabled={rawCuts.length === 0}
                    className="font-bold border-primary/20 hover:bg-primary/10 text-primary"
                >
                    <Download className="w-4 h-4 mr-2" />
                    Exportar Detalles
                </Button>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-card p-5 rounded-2xl border border-border shadow-sm">
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1 flex items-center gap-1"><ClipboardList className="w-3 h-3 text-primary" /> Turnos Revisados</p>
                    <p className="text-2xl font-black text-foreground">{kpis.totalCuts}</p>
                    <p className="text-xs text-emerald-500 font-bold mt-1">{kpis.perfectCuts} cuadres perfectos</p>
                </div>
                <div className="bg-card p-5 rounded-2xl border border-border shadow-sm">
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Efectivo Físico Detectado</p>
                    <p className="text-2xl font-black text-foreground">{formatCurrency(kpis.totalDeclared)}</p>
                </div>
                <div className="bg-card p-5 rounded-2xl border border-border shadow-sm">
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1 text-red-500/80">Diferencia Total (Mermas)</p>
                    <p className={`text-2xl font-black ${kpis.totalDiff < 0 ? 'text-red-500' : kpis.totalDiff > 0 ? 'text-emerald-500' : 'text-foreground'}`}>
                        {kpis.totalDiff > 0 ? '+' : ''}{formatCurrency(kpis.totalDiff)}
                    </p>
                </div>
                <div className="bg-card p-5 rounded-2xl border border-border shadow-sm bg-primary/5 flex flex-col justify-center">
                    <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-1 flex items-center gap-1">Estatus General</p>
                    <div className="flex items-center gap-2">
                        {kpis.totalDiff < 0 ? (
                            <><TrendingDown className="w-6 h-6 text-red-500" /> <span className="font-bold text-red-500">Faltante</span></>
                        ) : kpis.totalDiff > 0 ? (
                            <><TrendingUp className="w-6 h-6 text-emerald-500" /> <span className="font-bold text-emerald-500">Sobrante</span></>
                        ) : (
                            <><Shield className="w-6 h-6 text-primary" /> <span className="font-bold text-primary">Sano</span></>
                        )}
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
                <div className="p-5 border-b border-border/50">
                    <h4 className="text-sm font-black text-foreground">Historial de Cortes</h4>
                </div>
                {rawCuts.length > 0 ? (
                    <div className="flex flex-col">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-[10px] text-muted-foreground uppercase tracking-wider bg-muted/50">
                                    <tr>
                                        <th className="px-6 py-3 font-black">Turno</th>
                                        <th className="px-6 py-3 font-black">Cajero</th>
                                        <th className="px-6 py-3 font-black">Declarado Físico</th>
                                        <th className="px-6 py-3 font-black">Diferencia</th>
                                        <th className="px-6 py-3 font-black text-right">Fondo Inicial</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/50">
                                    {currentCuts.map(cut => {
                                        const isMissing = cut.diferencia < 0
                                        const isSurplus = cut.diferencia > 0

                                        return (
                                            <tr key={cut.id} className="hover:bg-muted/20">
                                                <td className="px-6 py-4 text-muted-foreground whitespace-nowrap">
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-foreground">ID: {cut.id.substring(0, 8)}</span>
                                                        <span className="text-xs">{new Date(cut.closed_at).toLocaleString('es-MX')}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 font-bold">
                                                    {cut.nombre_cajero || cut.empleado?.nombre || 'Administrador'}
                                                </td>
                                                <td className="px-6 py-4 font-black">
                                                    {formatCurrency(cut.monto_real)}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-bold uppercase ${isMissing ? 'bg-red-100 text-red-700' : isSurplus ? 'bg-emerald-100 text-emerald-700' : 'bg-primary/10 text-primary'}`}>
                                                        {isMissing ? <TrendingDown className="w-3 h-3" /> : isSurplus ? <TrendingUp className="w-3 h-3" /> : null}
                                                        {formatCurrency(cut.diferencia)}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 font-bold text-muted-foreground text-right">{formatCurrency(cut.fondo_inicial)}</td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                        {totalPages > 1 && (
                            <div className="flex items-center justify-between px-6 py-3 border-t border-border/50 bg-muted/20">
                                <span className="text-xs text-muted-foreground font-medium">
                                    Página {page} de {totalPages} ({rawCuts.length} registros)
                                </span>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setPage(p => Math.max(1, p - 1))}
                                        disabled={page === 1}
                                        className="h-8 w-8 p-0"
                                    >
                                        <ChevronLeft className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                        disabled={page === totalPages}
                                        className="h-8 w-8 p-0"
                                    >
                                        <ChevronRight className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="p-8 text-center text-muted-foreground text-sm font-medium">No hay cortes de caja cerrados en este período.</div>
                )}
            </div>
        </div>
    )
}
