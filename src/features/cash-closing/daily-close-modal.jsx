import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../auth/auth-context'
import { useTenant } from '../auth/tenant-context'
import { useTerminal } from '../auth/terminal-context'
import { getTodayShiftCuts, createDailyClose, hasDailyClose, getTodayExpenses } from '../../lib/session-service'
import { printDailyCloseReport } from '../../lib/print-service'
import { formatCurrency } from '../../lib/utils'
import { Button } from '../../components/ui/button'
import { toast } from 'sonner'
import {
    X, TrendingUp, Banknote, CreditCard, Landmark,
    Printer, CheckCircle2, Loader2, ShieldCheck,
    Clock, AlertTriangle, CalendarCheck
} from 'lucide-react'

export function DailyCloseModal({ onClose, onComplete }) {
    const { user } = useAuth()
    const { tenant } = useTenant()
    const { activeEmployee } = useTerminal()
    const queryClient = useQueryClient()
    const [step, setStep] = useState('review') // 'review' | 'confirm' | 'done'
    const [dailyCloseResult, setDailyCloseResult] = useState(null)

    const closerName = activeEmployee?.nombre
        || user?.user_metadata?.nombre
        || user?.user_metadata?.full_name
        || (user?.email ? user.email.split('@')[0] : 'Administrador')

    const { data: shiftCuts = [], isLoading: loadingCuts } = useQuery({
        queryKey: ['today-shift-cuts', tenant?.id],
        queryFn: () => getTodayShiftCuts(tenant.id),
        enabled: !!tenant?.id
    })

    const { data: todayExpenses = [], isLoading: loadingExpenses } = useQuery({
        queryKey: ['today-expenses', tenant?.id],
        queryFn: () => getTodayExpenses(tenant.id),
        enabled: !!tenant?.id
    })

    const { data: alreadyClosed } = useQuery({
        queryKey: ['has-daily-close', tenant?.id],
        queryFn: () => hasDailyClose(tenant.id),
        enabled: !!tenant?.id
    })

    const grossSales = shiftCuts.reduce((s, c) => s + parseFloat(c.total_amount || 0), 0)
    const totalCash = shiftCuts.reduce((s, c) => s + parseFloat(c.total_cash || 0), 0)
    const totalCard = shiftCuts.reduce((s, c) => s + parseFloat(c.total_card || 0), 0)
    const totalTransfer = shiftCuts.reduce((s, c) => s + parseFloat(c.total_transfer || 0), 0)
    const totalExpenses = todayExpenses.reduce((s, g) => s + parseFloat(g.monto || 0), 0)
    const netAmount = grossSales - totalExpenses

    const { mutate: doClose, isLoading: closing } = useMutation({
        mutationFn: () => createDailyClose(
            tenant.id, user.id, closerName, shiftCuts, todayExpenses
        ),
        onSuccess: (result) => {
            setDailyCloseResult(result)
            setStep('done')
            queryClient.invalidateQueries(['has-daily-close'])
            queryClient.invalidateQueries(['active-session'])
            toast.success('Cierre total del día registrado ✓')
        },
        onError: (err) => {
            toast.error(err.message || 'Error al generar el cierre total')
        }
    })

    const handlePrint = () => {
        printDailyCloseReport({
            restaurantName: tenant?.name || tenant?.nombre || 'Restaurante',
            dailyClose: dailyCloseResult,
            shiftCuts,
            expenses: todayExpenses
        })
    }

    const isLoading = loadingCuts || loadingExpenses

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-card rounded-3xl shadow-2xl w-full max-w-lg border border-border/50 overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-emerald-600 to-teal-700 p-6 text-white relative overflow-hidden">
                    <CalendarCheck className="absolute -right-4 -bottom-4 w-28 h-28 opacity-10" />
                    <div className="relative">
                        <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                                <ShieldCheck className="w-5 h-5" />
                                <span className="text-xs font-black uppercase tracking-widest opacity-80">Solo Admin / Gerente</span>
                            </div>
                            <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <h2 className="text-2xl font-black tracking-tight">Cierre Total del Día</h2>
                        <p className="text-sm opacity-70 mt-1">
                            {new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}
                        </p>
                    </div>
                </div>

                <div className="p-6 space-y-4 overflow-y-auto max-h-[60vh]">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        </div>
                    ) : step === 'done' ? (
                        <div className="text-center py-6 space-y-4">
                            <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
                                <CheckCircle2 className="w-10 h-10 text-emerald-600" />
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-foreground">¡Día cerrado exitosamente!</h3>
                                <p className="text-muted-foreground text-sm mt-1">El cierre total del día ha sido registrado.</p>
                            </div>
                            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
                                <p className="text-3xl font-black text-emerald-700">{formatCurrency(netAmount)}</p>
                                <p className="text-xs text-emerald-600 font-semibold uppercase tracking-wider mt-1">Beneficio neto del día</p>
                            </div>
                            <Button
                                onClick={handlePrint}
                                className="w-full h-12 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold gap-2"
                            >
                                <Printer className="w-5 h-5" /> Imprimir Reporte del Día
                            </Button>
                            <button onClick={() => { onComplete?.(); onClose() }} className="text-sm text-muted-foreground hover:text-foreground font-medium">
                                Cerrar sin imprimir
                            </button>
                        </div>
                    ) : alreadyClosed ? (
                        <div className="text-center py-8 space-y-3">
                            <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto">
                                <AlertTriangle className="w-8 h-8 text-amber-600" />
                            </div>
                            <p className="font-black text-lg">El día ya fue cerrado</p>
                            <p className="text-sm text-muted-foreground">Solo puede hacerse un cierre total por día.</p>
                        </div>
                    ) : (
                        <>
                            {shiftCuts.length === 0 && (
                                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3">
                                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                                    <p className="text-sm text-amber-800 font-medium">No hay cierres de turno registrados hoy. Asegúrate de cerrar todos los turnos primero.</p>
                                </div>
                            )}

                            {/* Summary */}
                            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-5 text-white space-y-3">
                                <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Resumen del Día</p>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <p className="text-xs opacity-60">Turnos</p>
                                        <p className="text-2xl font-black">{shiftCuts.length}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs opacity-60">Ventas Brutas</p>
                                        <p className="text-2xl font-black">{formatCurrency(grossSales)}</p>
                                    </div>
                                </div>
                                <div className="border-t border-white/10 pt-3 space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="opacity-60 flex items-center gap-1"><Banknote className="w-3.5 h-3.5" /> Efectivo</span>
                                        <span className="font-bold">{formatCurrency(totalCash)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="opacity-60 flex items-center gap-1"><CreditCard className="w-3.5 h-3.5" /> Tarjeta</span>
                                        <span className="font-bold">{formatCurrency(totalCard)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="opacity-60 flex items-center gap-1"><Landmark className="w-3.5 h-3.5" /> Transferencia</span>
                                        <span className="font-bold">{formatCurrency(totalTransfer)}</span>
                                    </div>
                                    {totalExpenses > 0 && (
                                        <div className="flex justify-between text-sm">
                                            <span className="opacity-60">Gastos (−)</span>
                                            <span className="font-bold text-red-400">-{formatCurrency(totalExpenses)}</span>
                                        </div>
                                    )}
                                </div>
                                <div className="border-t border-white/10 pt-3 flex justify-between items-center">
                                    <span className="font-black uppercase tracking-wide text-sm">Neto del Día</span>
                                    <span className={`text-2xl font-black ${netAmount >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatCurrency(netAmount)}</span>
                                </div>
                            </div>

                            {/* Shift breakdown */}
                            <div>
                                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
                                    <Clock className="w-3.5 h-3.5" /> Turnos hoy
                                </p>
                                <div className="space-y-2">
                                    {shiftCuts.map((cut, i) => (
                                        <div key={cut.id} className="flex justify-between items-center p-3 bg-muted/40 rounded-xl border border-border/50">
                                            <div>
                                                <p className="text-sm font-bold">Turno {i + 1} · {cut.closed_by_name || 'Cajero'}</p>
                                                <p className="text-[10px] text-muted-foreground">{new Date(cut.cut_date || cut.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</p>
                                            </div>
                                            <span className="font-black text-sm">{formatCurrency(cut.total_amount || 0)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* Footer actions */}
                {step !== 'done' && !alreadyClosed && !isLoading && (
                    <div className="p-6 pt-0 border-t border-border/50 mt-2 space-y-3">
                        {step === 'review' && (
                            <>
                                <Button
                                    onClick={() => setStep('confirm')}
                                    disabled={shiftCuts.length === 0}
                                    className="w-full h-14 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-black text-base shadow-lg shadow-emerald-600/30 hover:scale-[1.01] transition-transform disabled:opacity-50 disabled:scale-100"
                                >
                                    Generar Cierre Total del Día
                                </Button>
                                <button onClick={onClose} className="w-full text-center text-sm text-muted-foreground hover:text-foreground font-medium py-1">
                                    Cancelar
                                </button>
                            </>
                        )}
                        {step === 'confirm' && (
                            <>
                                <p className="text-center text-sm font-bold text-foreground">¿Confirmar cierre total del día?</p>
                                <p className="text-center text-xs text-muted-foreground">Esta acción no se puede deshacer. Solo puede hacerse una vez por día.</p>
                                <Button
                                    onClick={() => doClose()}
                                    disabled={closing}
                                    className="w-full h-14 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-black text-base"
                                >
                                    {closing ? <Loader2 className="w-5 h-5 animate-spin" /> : 'SÍ, CERRAR EL DÍA'}
                                </Button>
                                <button onClick={() => setStep('review')} className="w-full text-center text-sm text-muted-foreground hover:text-foreground font-medium py-1">
                                    Volver a revisar
                                </button>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
