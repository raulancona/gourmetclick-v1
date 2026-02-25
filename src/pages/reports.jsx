import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTenant } from '../features/auth/tenant-context'
import { getSessionsHistory } from '../lib/order-service'
import { formatCurrency } from '../lib/utils'
import {
    Loader2, CheckCircle2, TrendingUp, TrendingDown,
    Clock, User, Shield, Download, ClipboardList
} from 'lucide-react'
import { Button } from '../components/ui/button'
import { CortesHistory } from '../features/cash-closing/cortes-history'

export function ReportsPage() {
    const { tenant } = useTenant()

    const { data: history = [], isLoading } = useQuery({
        queryKey: ['sessions-history', tenant?.id],
        queryFn: () => getSessionsHistory(tenant.id),
        enabled: !!tenant?.id
    })

    const closedSessions = history.filter(s => s.estado === 'cerrada')

    // Audit KPIs — from closed sessions
    const totalDeclared = closedSessions.reduce((sum, s) => sum + parseFloat(s.monto_real || 0), 0)
    const totalExpenses = closedSessions.reduce((sum, s) => sum + parseFloat(s.total_gastos || 0), 0)
    const totalDiff = closedSessions.reduce((sum, s) => sum + parseFloat(s.diferencia || 0), 0)
    const totalSessions = closedSessions.length
    const perfectCuts = closedSessions.filter(s => parseFloat(s.diferencia || 0) === 0).length

    const handleExportCSV = () => {
        if (closedSessions.length === 0) return

        const headers = ['ID Sesion', 'Fecha Apertura', 'Fecha Cierre', 'Cajero', 'Fondo Inicial', 'Ventas Esperadas', 'Monto Real', 'Diferencia', 'Gastos']
        const rows = closedSessions.map(s => [
            s.id.slice(0, 8),
            new Date(s.opened_at).toLocaleString('es-MX'),
            s.closed_at ? new Date(s.closed_at).toLocaleString('es-MX') : 'N/A',
            s.nombre_cajero || s.empleado?.nombre || 'Administrador',
            s.fondo_inicial,
            s.monto_esperado,
            s.monto_real,
            s.diferencia,
            s.total_gastos || 0
        ])

        const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `auditoria_caja_${new Date().toISOString().split('T')[0]}.csv`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    if (isLoading) {
        return <div className="p-8 flex items-center justify-center min-h-[400px]"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
    }

    return (
        <div className="p-4 sm:p-8 space-y-6 max-w-7xl mx-auto pb-20">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-foreground flex items-center gap-2">
                        <ClipboardList className="w-8 h-8 text-primary" />
                        Auditoría de Caja
                    </h1>
                    <p className="text-muted-foreground font-medium">Bitácora de turnos y cortes de caja por cajero</p>
                </div>
                <Button
                    onClick={handleExportCSV}
                    disabled={closedSessions.length === 0}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl px-6 h-12 shadow-lg shadow-primary/20"
                >
                    <Download className="w-5 h-5 mr-2" />
                    Exportar CSV
                </Button>
            </div>

            {/* Audit KPI Strip */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-card border border-border rounded-2xl p-5 shadow-sm border-l-4 border-l-primary">
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Turnos Cerrados</p>
                    <p className="text-3xl font-black text-foreground">{totalSessions}</p>
                    <p className="text-xs text-muted-foreground mt-1">{perfectCuts} cuadres perfectos</p>
                </div>
                <div className="bg-card border border-border rounded-2xl p-5 shadow-sm border-l-4 border-l-amber-500">
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Total Declarado</p>
                    <p className="text-3xl font-black text-foreground">{formatCurrency(totalDeclared)}</p>
                    <p className="text-xs text-muted-foreground mt-1">Suma de montos reales</p>
                </div>
                <div className="bg-card border border-border rounded-2xl p-5 shadow-sm border-l-4 border-l-red-500">
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Gastos Operativos</p>
                    <p className="text-3xl font-black text-foreground">{formatCurrency(totalExpenses)}</p>
                    <p className="text-xs text-muted-foreground mt-1">Total registrado en turnos</p>
                </div>
                <div className="bg-card border border-border rounded-2xl p-5 shadow-sm border-l-4 border-l-emerald-500">
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Diferencia acumulada</p>
                    <p className={`text-3xl font-black ${totalDiff < 0 ? 'text-red-500' : totalDiff > 0 ? 'text-emerald-500' : 'text-foreground'}`}>
                        {totalDiff >= 0 ? '+' : ''}{formatCurrency(totalDiff)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">{totalDiff < 0 ? 'Faltante acumulado' : totalDiff > 0 ? 'Sobrante acumulado' : 'Sin diferencias'}</p>
                </div>
            </div>

            {/* Cortes History */}
            <CortesHistory />
        </div>
    )
}
