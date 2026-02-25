import { useState, useEffect, useRef } from 'react'
import { X, Banknote, CreditCard, Landmark, CheckCircle2, Loader2, ArrowRight } from 'lucide-react'
import { formatCurrency } from '../../../lib/utils'

const DENOMINATIONS = [50, 100, 200, 500]

function CashView({ total, onConfirm, isSubmitting }) {
    const [received, setReceived] = useState('')
    const inputRef = useRef(null)

    useEffect(() => {
        inputRef.current?.focus()
    }, [])

    const parsed = parseFloat(received) || 0
    const change = parsed - total
    const isValid = parsed >= total && parsed > 0

    const addDenomination = (amount) => {
        setReceived(prev => {
            const current = parseFloat(prev) || 0
            return String(current + amount)
        })
    }

    const setExact = () => setReceived(String(total))

    return (
        <div className="space-y-6">
            {/* Total display */}
            <div className="text-center">
                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-1">Total a cobrar</p>
                <p className="text-5xl font-black text-foreground tracking-tighter">{formatCurrency(total)}</p>
            </div>

            {/* Quick denominations */}
            <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">Denominaciones rápidas</p>
                <div className="grid grid-cols-4 gap-2">
                    {DENOMINATIONS.map(d => (
                        <button
                            key={d}
                            onClick={() => addDenomination(d)}
                            className="py-3 rounded-xl bg-muted/50 hover:bg-primary/10 hover:text-primary border border-border hover:border-primary/30 font-black text-sm transition-all active:scale-95"
                        >
                            ${d}
                        </button>
                    ))}
                </div>
                <button
                    onClick={setExact}
                    className="mt-2 w-full py-2.5 rounded-xl border border-border text-xs font-bold text-muted-foreground hover:border-primary hover:text-primary transition-all"
                >
                    Exacto ({formatCurrency(total)})
                </button>
            </div>

            {/* Input */}
            <div className="space-y-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Con cuánto paga</p>
                <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-black text-muted-foreground select-none">$</span>
                    <input
                        ref={inputRef}
                        type="number"
                        value={received}
                        onChange={e => setReceived(e.target.value)}
                        placeholder="0"
                        inputMode="decimal"
                        className="w-full pl-10 pr-4 py-4 text-3xl font-black bg-muted/30 border-2 border-border rounded-2xl focus:outline-none focus:border-primary transition-colors text-right"
                    />
                </div>
            </div>

            {/* Change */}
            <div className={`flex items-center justify-between p-4 rounded-2xl transition-all ${isValid ? 'bg-green-500/10 border border-green-500/30' : 'bg-muted/30 border border-border'}`}>
                <span className="text-sm font-black uppercase tracking-wider text-muted-foreground">Cambio</span>
                <span className={`text-3xl font-black tabular-nums tracking-tight ${isValid ? 'text-green-500' : 'text-muted-foreground'}`}>
                    {isValid ? formatCurrency(change) : '--'}
                </span>
            </div>

            {/* Confirm */}
            <button
                onClick={() => onConfirm({ montoRecibido: parsed, cambio: change })}
                disabled={!isValid || isSubmitting}
                className="w-full py-5 rounded-2xl bg-primary text-primary-foreground font-black text-lg shadow-lg shadow-primary/30 hover:shadow-primary/50 hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-[0.98] flex items-center justify-center gap-3"
            >
                {isSubmitting ? <Loader2 className="w-6 h-6 animate-spin" /> : (
                    <>
                        <CheckCircle2 className="w-6 h-6" />
                        Cobrar {formatCurrency(total)}
                    </>
                )}
            </button>
        </div>
    )
}

function DigitalView({ total, label, onConfirm, isSubmitting }) {
    return (
        <div className="space-y-8">
            <div className="text-center py-4">
                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-2">{label}</p>
                <p className="text-5xl font-black text-foreground tracking-tighter">{formatCurrency(total)}</p>
                <p className="text-sm text-muted-foreground mt-3 font-medium">Confirma cuando el pago esté procesado</p>
            </div>

            <button
                onClick={() => onConfirm({ montoRecibido: total, cambio: 0 })}
                disabled={isSubmitting}
                className="w-full py-5 rounded-2xl bg-primary text-primary-foreground font-black text-lg shadow-lg shadow-primary/30 hover:opacity-90 disabled:opacity-40 transition-all active:scale-[0.98] flex items-center justify-center gap-3"
            >
                {isSubmitting ? <Loader2 className="w-6 h-6 animate-spin" /> : (
                    <>
                        <CheckCircle2 className="w-6 h-6" />
                        Confirmar Cobro
                    </>
                )}
            </button>
        </div>
    )
}

export function PaymentModal({ isOpen, onClose, total, paymentMethod, onConfirm, isSubmitting }) {
    if (!isOpen) return null

    const methodConfig = {
        cash: { label: 'Pago en Efectivo', icon: Banknote, color: 'text-green-500' },
        card: { label: 'Pago con Tarjeta', icon: CreditCard, color: 'text-blue-500' },
        transfer: { label: 'Transferencia', icon: Landmark, color: 'text-violet-400' },
    }
    const config = methodConfig[paymentMethod] || methodConfig.cash
    const Icon = config.icon

    return (
        <div
            className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-6"
            onClick={onClose}
        >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/70 backdrop-blur-md" />

            {/* Sheet */}
            <div
                className="relative w-full sm:max-w-sm bg-card rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl border border-border animate-in slide-in-from-bottom sm:zoom-in-90 duration-300"
                onClick={e => e.stopPropagation()}
            >
                {/* Handle */}
                <div className="sm:hidden w-10 h-1.5 bg-muted-foreground/30 rounded-full mx-auto mt-4 mb-2" />

                <div className="p-6">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-2xl bg-muted flex items-center justify-center ${config.color}`}>
                                <Icon className="w-5 h-5" />
                            </div>
                            <div>
                                <h2 className="text-lg font-black text-foreground leading-none">{config.label}</h2>
                                <p className="text-xs text-muted-foreground font-medium mt-0.5">Confirmar cobro</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Content by payment type */}
                    {paymentMethod === 'cash'
                        ? <CashView total={total} onConfirm={onConfirm} isSubmitting={isSubmitting} />
                        : <DigitalView total={total} label={config.label} onConfirm={onConfirm} isSubmitting={isSubmitting} />
                    }
                </div>
            </div>
        </div>
    )
}
