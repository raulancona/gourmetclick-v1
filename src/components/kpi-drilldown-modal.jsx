import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { X, ChevronLeft, ChevronRight, PackageOpen } from 'lucide-react'
import { Button } from './ui/button'

export function KpiDrilldownModal({
    isOpen,
    onClose,
    kpi,          // { label, value, color, icon: Icon }
    queryKey,     // Array para React Query, e.g. ['kpi-detail', 'orders', status]
    fetchFn,      // Función async (page, pageSize) => { data: [], count: number }
    renderItem,   // Componente de UI para cada fila (item) => ReactNode
    pageSize = 10,
    emptyMessage = "No hay información disponible para esta métrica."
}) {
    const [page, setPage] = useState(1)

    // Reset pagination when modal opens or KPI changes
    useEffect(() => {
        if (isOpen) {
            setPage(1)
        }
    }, [isOpen, kpi?.label])

    const { data: result, isLoading, isError } = useQuery({
        queryKey: [...queryKey, page, pageSize],
        queryFn: () => fetchFn(page, pageSize),
        enabled: isOpen && !!kpi,
    })

    if (!isOpen || !kpi) return null

    const items = result?.data || []
    const totalCount = result?.count || 0
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
            <div className="relative bg-card w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="shrink-0 p-5 lg:p-6 border-b border-border/60 flex items-center justify-between bg-muted/30 z-10">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center shadow-inner" style={{ background: `${kpi.color}15`, color: kpi.color }}>
                            {kpi.icon && <kpi.icon className="w-6 h-6" />}
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-foreground">{kpi.label}</h2>
                            <p className="text-sm font-medium text-muted-foreground mt-0.5">
                                Desglose detallado &bull; <strong className="text-foreground">{kpi.value}</strong> registrados
                            </p>
                        </div>
                    </div>
                    <Button variant="ghost" size="icon" className="rounded-full hover:bg-black/5" onClick={onClose}>
                        <X className="w-5 h-5" />
                    </Button>
                </div>

                {/* Body (List) */}
                <div className="p-5 lg:p-6 overflow-y-auto space-y-2 flex-1 relative">
                    {isLoading ? (
                        <div className="py-20 flex flex-col items-center justify-center opacity-70">
                            <div className="w-8 h-8 rounded-full border-4 border-muted border-t-primary animate-spin mb-3" />
                            <p className="font-bold text-sm text-foreground">Consultando base de datos...</p>
                        </div>
                    ) : isError ? (
                        <div className="py-20 text-center opacity-70">
                            <PackageOpen className="w-12 h-12 mx-auto mb-3 opacity-30 text-red-500" />
                            <p className="font-bold text-red-500">Ocurrió un error al cargar los datos.</p>
                        </div>
                    ) : items.length === 0 ? (
                        <div className="text-center py-20 opacity-70">
                            {kpi.icon ? <kpi.icon className="w-12 h-12 mx-auto mb-3 opacity-20" /> : <PackageOpen className="w-12 h-12 mx-auto mb-3 opacity-20" />}
                            <p className="font-bold">{emptyMessage}</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {items.map((item, index) => renderItem(item, index))}
                        </div>
                    )}
                </div>

                {/* Footer (Pagination) */}
                <div className="shrink-0 p-4 border-t border-border/60 flex items-center justify-between bg-card z-10">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                        Página {page} de {totalPages} <span className="lowercase font-medium ml-1">({totalCount} totales)</span>
                    </p>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1 || isLoading}
                            className="h-8 shadow-sm"
                        >
                            <ChevronLeft className="w-4 h-4 mr-1" /> Anterior
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages || isLoading}
                            className="h-8 shadow-sm"
                        >
                            Siguiente <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}
