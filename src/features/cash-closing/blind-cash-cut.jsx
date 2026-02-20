import { useState, useMemo } from 'react'
import { Banknote, Loader2, CheckCircle2, AlertCircle, TrendingUp, TrendingDown, ShieldCheck, CreditCard } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card'
import { toast } from 'sonner'
import { closeSession } from '../../lib/order-service'
import { useAuth } from '../auth/auth-context'
import { formatCurrency } from '../../lib/utils'

export function BlindCashCut({ onComplete, session, isAdmin, orders = [] }) {
    const { user } = useAuth()
    const [montoReal, setMontoReal] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [showConfirm, setShowConfirm] = useState(false)

    // Client-side summary — derived from the same orders array shown in the panel.
    // Includes any order that has a payment_method assigned, regardless of status.
    const summary = useMemo(() => {
        const billableOrders = orders.filter(o => o.payment_method)
        const totalSales = billableOrders.reduce((sum, o) => sum + (parseFloat(o.total) || 0), 0)
        const byPayment = billableOrders.reduce(
            (acc, o) => {
                const method = o.payment_method || 'cash'
                acc[method] = (acc[method] || 0) + (parseFloat(o.total) || 0)
                return acc
            },
            { cash: 0, card: 0, transfer: 0 }
        )
        return { totalSales, totalExpenses: 0, byPayment }
    }, [orders])

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!montoReal || parseFloat(montoReal) < 0) {
            toast.error('Ingresa un monto válido')
            return
        }
        setShowConfirm(true)
    }

    const confirmCut = async () => {
        try {
            setIsLoading(true)
            if (!session?.id) throw new Error('No hay una sesión activa para cerrar')

            await closeSession(session.id, montoReal, user.id, user.user_metadata?.nombre || user.email || 'Admin', expectedBalance)
            toast.success('Sesión de caja cerrada con éxito')
            setMontoReal('')
            setShowConfirm(false)
            if (onComplete) onComplete()
        } catch (error) {
            console.error('Error performing blind cut:', error)
            toast.error('Error al cerrar la sesión: ' + error.message)
        } finally {
            setIsLoading(false)
        }
    }

    const expectedBalance = parseFloat(session?.fondo_inicial || 0) + summary.totalSales - summary.totalExpenses
    const difference = parseFloat(montoReal || 0) - expectedBalance

    if (showConfirm) {
        return (
            <Card className="max-w-md mx-auto border-border/50 shadow-xl p-10 text-center space-y-8 rounded-[2.5rem] bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50">
                <div className="w-24 h-24 bg-white/50 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-2 animate-bounce shadow-inner">
                    <AlertCircle className="w-12 h-12" />
                </div>
                <div>
                    <h3 className="text-3xl font-black text-amber-900 dark:text-amber-400 uppercase tracking-tight">¿Confirmar Cierre?</h3>
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-500 mt-4 leading-relaxed">
                        Has reportado <span className="font-black text-xl underline px-1">${parseFloat(montoReal).toFixed(2)}</span> en efectivo.<br />
                        {isAdmin ? 'El balance será guardado y el turno será cerrado inmediatamente.' : 'No podrás modificar este reporte una vez enviado.'}
                    </p>
                </div>

                <div className="flex flex-col gap-4">
                    <Button
                        onClick={confirmCut}
                        className="h-16 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xl shadow-lg shadow-amber-600/30"
                        disabled={isLoading}
                    >
                        {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : 'SÍ, CERRAR TURNO'}
                    </Button>
                    <Button
                        variant="ghost"
                        onClick={() => setShowConfirm(false)}
                        className="font-bold text-amber-800 dark:text-amber-500 hover:bg-amber-100"
                        disabled={isLoading}
                    >
                        Volver al conteo
                    </Button>
                </div>
            </Card>
        )
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className={`grid grid-cols-1 ${isAdmin ? 'md:grid-cols-2' : ''} gap-6 items-start`}>
                {/* Input Section */}
                <Card className="border-border/50 shadow-xl overflow-hidden rounded-[2.5rem]">
                    <div className="bg-primary p-8 text-primary-foreground text-center relative overflow-hidden">
                        <Banknote className="w-24 h-24 absolute -bottom-6 -right-6 opacity-10 rotate-12" />
                        <h2 className="text-xl font-black mb-1 uppercase tracking-tight">Cierre de Turno</h2>
                        <p className="text-[10px] font-black uppercase opacity-60 tracking-widest">Procedimiento de Cuadre</p>
                    </div>

                    <form onSubmit={handleSubmit} className="p-8 space-y-6">
                        <div className="space-y-3">
                            <Label htmlFor="montoReal" className="text-[10px] font-black uppercase text-muted-foreground tracking-widest text-center block">
                                Dinero Físico en Caja
                            </Label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-black text-muted-foreground">$</span>
                                <Input
                                    id="montoReal"
                                    type="number"
                                    step="0.01"
                                    value={montoReal}
                                    onChange={(e) => setMontoReal(e.target.value)}
                                    className="h-20 text-4xl font-black text-center pl-10 bg-muted/30 border-none focus-visible:ring-primary rounded-2xl"
                                    placeholder="0.00"
                                    autoFocus
                                    required
                                />
                            </div>
                        </div>

                        <Button
                            type="submit"
                            className="w-full h-16 rounded-2xl text-lg font-black shadow-lg shadow-primary/20 hover:scale-[1.02] transition-transform"
                            disabled={isLoading}
                        >
                            Validar Cierre
                        </Button>

                        <p className="text-[9px] text-center text-muted-foreground font-bold uppercase tracking-widest leading-relaxed">
                            ⚠️ Asegura el conteo antes de proceder.
                        </p>
                    </form>
                </Card>

                {/* Admin Visual Feedback Section */}
                {isAdmin && summary && (
                    <Card className="border-primary/20 bg-primary/5 p-8 rounded-[2.5rem] space-y-6">
                        <div className="flex items-center gap-2 mb-2">
                            <ShieldCheck className="w-5 h-5 text-primary" />
                            <h3 className="font-black text-sm uppercase tracking-tight">Auditoría en Tiempo Real</h3>
                        </div>

                        <div className="space-y-4">
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-muted-foreground font-bold italic">Fondo Inicial:</span>
                                <span className="font-black">{formatCurrency(session.fondo_inicial)}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-muted-foreground font-bold italic">Ventas (+):</span>
                                <span className="font-black text-emerald-600">{formatCurrency(summary.totalSales)}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="font-black text-red-600">-{formatCurrency(summary.totalExpenses)}</span>
                            </div>

                            {/* Payment Breakdown */}
                            <div className="bg-primary/5 rounded-xl p-3 space-y-2 border border-primary/10">
                                <p className="text-[10px] uppercase font-black tracking-widest text-primary/70 mb-1">Desglose por Método</p>
                                <div className="flex justify-between items-center text-xs">
                                    <span className="flex items-center gap-1.5"><Banknote className="w-3 h-3 text-emerald-600" /> Efectivo</span>
                                    <span className="font-bold">{formatCurrency(summary.byPayment?.cash || 0)}</span>
                                </div>
                                <div className="flex justify-between items-center text-xs">
                                    <span className="flex items-center gap-1.5"><CreditCard className="w-3 h-3 text-blue-600" /> Tarjeta</span>
                                    <span className="font-bold">{formatCurrency(summary.byPayment?.card || 0)}</span>
                                </div>
                                <div className="flex justify-between items-center text-xs">
                                    <span className="flex items-center gap-1.5"><TrendingUp className="w-3 h-3 text-purple-600" /> Transferencia</span>
                                    <span className="font-bold">{formatCurrency(summary.byPayment?.transfer || 0)}</span>
                                </div>
                            </div>
                            <div className="pt-4 border-t border-primary/10 flex justify-between items-center">
                                <span className="text-xs font-black uppercase tracking-widest text-primary">Saldo Esperado:</span>
                                <span className="text-xl font-black text-primary">{formatCurrency(expectedBalance)}</span>
                            </div>

                            {/* Live Difference */}
                            {montoReal && (
                                <div className={`p-4 rounded-2xl flex items-center justify-between ${difference < 0 ? 'bg-red-500/10 text-red-600' : 'bg-emerald-500/10 text-emerald-600'}`}>
                                    <div className="flex items-center gap-2">
                                        {difference < 0 ? <TrendingDown className="w-5 h-5" /> : <TrendingUp className="w-5 h-5" />}
                                        <span className="text-xs font-black uppercase">Diferencia</span>
                                    </div>
                                    <span className="text-lg font-black">{formatCurrency(difference)}</span>
                                </div>
                            )}
                        </div>
                    </Card>
                )}
            </div>
        </div>
    )
}
