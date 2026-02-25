import { useState, useMemo } from 'react'
import { Banknote, Loader2, AlertCircle, TrendingUp, TrendingDown, ShieldCheck } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Card } from '../../components/ui/card'
import { toast } from 'sonner'
import { closeSession } from '../../lib/order-service'
import { useAuth } from '../auth/auth-context'
import { useTerminal } from '../auth/terminal-context'
import { formatCurrency } from '../../lib/utils'

export function BlindCashCut({ onComplete, session, isAdmin, orders = [], expenses = [] }) {
    const { user } = useAuth()
    const { activeEmployee } = useTerminal()
    const [montoReal, setMontoReal] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [showConfirm, setShowConfirm] = useState(false)

    // ─── Blind summary: CASH ONLY ─────────────────────────────────────────────
    // Principle: The blind cut only validates PHYSICAL cash in the register.
    // Card and transfer receipts are not counted physically, so they're excluded.
    // The expected = fondo_inicial + cash_sales - cash_expenses
    const summary = useMemo(() => {
        const cashOrders = orders.filter(o => !o.payment_method || o.payment_method === 'cash')
        const cashSales = cashOrders.reduce((sum, o) => sum + (parseFloat(o.total) || 0), 0)

        // Non-cash sales (card/transfer) - shown for audit reference only
        const cardSales = orders
            .filter(o => o.payment_method === 'card')
            .reduce((sum, o) => sum + (parseFloat(o.total) || 0), 0)
        const transferSales = orders
            .filter(o => o.payment_method === 'transfer')
            .reduce((sum, o) => sum + (parseFloat(o.total) || 0), 0)

        // Expenses paid in cash only affect the physical register
        const cashExpenses = expenses
            .filter(g => !g.medio_pago || g.medio_pago === 'cash')
            .reduce((sum, g) => sum + (parseFloat(g.monto) || 0), 0)

        return { cashSales, cardSales, transferSales, cashExpenses }
    }, [orders, expenses])

    // Physical expected balance = fondo + cash sales - cash expenses
    const expectedCash = parseFloat(session?.fondo_inicial || 0) + summary.cashSales - summary.cashExpenses
    const difference = parseFloat(montoReal || 0) - expectedCash

    // ─── Who is closing? ─────────────────────────────────────────────────────
    // Prefer the active staff employee (POS PIN login), else fall back to auth user
    const closerName = activeEmployee?.nombre
        || user?.user_metadata?.nombre
        || user?.user_metadata?.full_name
        || (user?.email ? user.email.split('@')[0] : 'Administrador')

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

            await closeSession(session.id, montoReal, user.id, closerName, expectedCash)
            toast.success('Turno cerrado con éxito ✓')
            setMontoReal('')
            setShowConfirm(false)
            if (onComplete) onComplete()
        } catch (error) {
            console.error('Error closing session:', error)
            toast.error('Error al cerrar: ' + error.message)
        } finally {
            setIsLoading(false)
        }
    }

    // ─── Confirmation screen ─────────────────────────────────────────────────
    if (showConfirm) {
        return (
            <Card className="max-w-md mx-auto border-border/50 shadow-xl p-10 text-center space-y-8 rounded-[2.5rem] bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50">
                <div className="w-24 h-24 bg-white/50 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-2 animate-bounce shadow-inner">
                    <AlertCircle className="w-12 h-12" />
                </div>
                <div>
                    <h3 className="text-3xl font-black text-amber-900 dark:text-amber-400 uppercase tracking-tight">¿Confirmar Cierre?</h3>
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-500 mt-4 leading-relaxed">
                        Cajero: <span className="font-black">{closerName}</span><br />
                        Efectivo declarado: <span className="font-black text-xl underline px-1">${parseFloat(montoReal).toFixed(2)}</span><br />
                        <span className="text-xs opacity-70 mt-1 block">Esta acción cerrará el turno y no se podrá deshacer.</span>
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

    // ─── Main UI ─────────────────────────────────────────────────────────────
    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className={`grid grid-cols-1 ${isAdmin ? 'md:grid-cols-2' : ''} gap-6 items-start`}>
                {/* Input: Cashier enters only physical cash count */}
                <Card className="border-border/50 shadow-xl overflow-hidden rounded-[2.5rem]">
                    <div className="bg-primary p-8 text-primary-foreground text-center relative overflow-hidden">
                        <Banknote className="w-24 h-24 absolute -bottom-6 -right-6 opacity-10 rotate-12" />
                        <h2 className="text-xl font-black mb-1 uppercase tracking-tight">Cierre de Turno</h2>
                        <p className="text-[10px] font-black uppercase opacity-60 tracking-widest">Corte a Ciegas — Solo efectivo</p>
                    </div>

                    <form onSubmit={handleSubmit} className="p-8 space-y-6">
                        <div className="space-y-3">
                            <Label htmlFor="montoReal" className="text-[10px] font-black uppercase text-muted-foreground tracking-widest text-center block">
                                💵 ¿Cuánto efectivo hay en caja?
                            </Label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-black text-muted-foreground">$</span>
                                <Input
                                    id="montoReal"
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={montoReal}
                                    onChange={(e) => setMontoReal(e.target.value)}
                                    className="h-20 text-4xl font-black text-center pl-10 bg-muted/30 border-none focus-visible:ring-primary rounded-2xl"
                                    placeholder="0.00"
                                    autoFocus
                                    required
                                />
                            </div>
                            <p className="text-[10px] text-center text-muted-foreground font-semibold">
                                Cuenta solo el dinero físico en la caja.<br />
                                Tarjeta y transferencia no cuentan.
                            </p>
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

                {/* Admin: Real-time audit panel (hidden from cashier intentionally) */}
                {isAdmin && (
                    <Card className="border-primary/20 bg-primary/5 p-8 rounded-[2.5rem] space-y-5">
                        <div className="flex items-center gap-2 mb-2">
                            <ShieldCheck className="w-5 h-5 text-primary" />
                            <h3 className="font-black text-sm uppercase tracking-tight">Auditoría en Tiempo Real</h3>
                        </div>

                        <div className="space-y-3">
                            {/* Cash breakdown */}
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-muted-foreground font-bold italic">Fondo Inicial:</span>
                                <span className="font-black">{formatCurrency(session?.fondo_inicial || 0)}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-muted-foreground font-bold italic">💵 Efectivo (+):</span>
                                <span className="font-black text-emerald-600">{formatCurrency(summary.cashSales)}</span>
                            </div>
                            {summary.cashExpenses > 0 && (
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-muted-foreground font-bold italic">Gastos efectivo (−):</span>
                                    <span className="font-black text-red-600">−{formatCurrency(summary.cashExpenses)}</span>
                                </div>
                            )}

                            {/* Expected cash */}
                            <div className="pt-3 border-t border-primary/10 flex justify-between items-center">
                                <span className="text-xs font-black uppercase tracking-widest text-primary">💰 Efectivo Esperado:</span>
                                <span className="text-xl font-black text-primary">{formatCurrency(expectedCash)}</span>
                            </div>

                            {/* Live difference */}
                            {montoReal && (
                                <div className={`p-4 rounded-2xl flex items-center justify-between ${difference < 0 ? 'bg-red-500/10 text-red-600' : 'bg-emerald-500/10 text-emerald-600'}`}>
                                    <div className="flex items-center gap-2">
                                        {difference < 0 ? <TrendingDown className="w-5 h-5" /> : <TrendingUp className="w-5 h-5" />}
                                        <span className="text-xs font-black uppercase">Diferencia en efectivo</span>
                                    </div>
                                    <span className="text-lg font-black">{formatCurrency(difference)}</span>
                                </div>
                            )}

                            {/* Non-cash reference (card + transfer totals only, not counted) */}
                            {(summary.cardSales > 0 || summary.transferSales > 0) && (
                                <div className="bg-muted/40 rounded-xl p-4 space-y-2 border border-border">
                                    <p className="text-[10px] uppercase font-black tracking-widest text-muted-foreground mb-1">Solo referencia (no cuentan en efectivo)</p>
                                    {summary.cardSales > 0 && (
                                        <div className="flex justify-between text-xs">
                                            <span className="text-muted-foreground">💳 Tarjeta</span>
                                            <span className="font-bold">{formatCurrency(summary.cardSales)}</span>
                                        </div>
                                    )}
                                    {summary.transferSales > 0 && (
                                        <div className="flex justify-between text-xs">
                                            <span className="text-muted-foreground">🏦 Transferencia</span>
                                            <span className="font-bold">{formatCurrency(summary.transferSales)}</span>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Expenses detail */}
                            {expenses.length > 0 && (
                                <div className="bg-red-500/5 rounded-xl p-3 space-y-1 border border-red-500/10">
                                    <p className="text-[10px] uppercase font-black tracking-widest text-red-500/70 mb-1">Detalle de Gastos</p>
                                    {expenses.map(g => (
                                        <div key={g.id} className="flex justify-between text-xs">
                                            <span className="text-muted-foreground truncate max-w-[60%]">{g.descripcion || g.categoria || 'Gasto'}</span>
                                            <span className="font-bold text-red-600">−{formatCurrency(g.monto)}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </Card>
                )}
            </div>
        </div>
    )
}
