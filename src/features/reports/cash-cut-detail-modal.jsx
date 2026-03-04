import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getCashCutDetails } from '../../lib/reports-service'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '../../components/ui/dialog'
import { Loader2, AlertCircle, Receipt, ArrowRight, Wallet, ArrowDownCircle, Banknote, HelpCircle, XCircle } from 'lucide-react'
import { formatCurrency } from '../../lib/utils'

export function CashCutDetailModal({ cutId, isOpen, onClose }) {
    const [activeTab, setActiveTab] = useState('math') // math, orders, expenses
    const { data, isLoading, error } = useQuery({
        queryKey: ['cash-cut-details', cutId],
        queryFn: () => getCashCutDetails(cutId),
        enabled: !!cutId && isOpen,
        staleTime: 1000 * 60 * 5, // 5 minutes cache to avoid network spam on reopen
    })

    const calculatedData = useMemo(() => {
        if (!data) return null;
        const { cut, orders, expenses } = data;

        // Sums
        const totalGastos = expenses.reduce((acc, curr) => acc + parseFloat(curr.monto || 0), 0);
        const cashOrders = orders.filter(o => o.payment_method === 'cash' && o.status === 'delivered');
        const totalVentasEfectivo = cashOrders.reduce((acc, curr) => acc + parseFloat(curr.total || 0), 0);
        const nonCashOrders = orders.filter(o => o.payment_method !== 'cash' && o.status === 'delivered');

        // Math formula values
        const fondo = parseFloat(cut.fondo_inicial || 0)
        const efectivoReal = parseFloat(cut.monto_real || 0)
        const diferencia = parseFloat(cut.diferencia || 0)

        // El esperado puro del sistema
        const esperado = fondo + totalVentasEfectivo - totalGastos;

        return {
            cut, orders, expenses,
            cashOrders, nonCashOrders,
            totalGastos, totalVentasEfectivo,
            fondo, esperado, efectivoReal, diferencia
        }
    }, [data])

    if (!isOpen) return null;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0 bg-background border-border sm:rounded-[2rem]">
                <DialogHeader className="p-6 pb-2 shrink-0 border-b border-border/50 bg-muted/20">
                    <DialogTitle className="text-xl font-black flex items-center gap-2">
                        <Wallet className="w-5 h-5 text-primary" />
                        Detalle del Turno
                        <span className="text-sm font-bold bg-muted px-2 py-0.5 rounded-md ml-2 text-muted-foreground">ID: {cutId?.substring(0, 8)}</span>
                    </DialogTitle>
                    <DialogDescription className="text-sm font-medium">
                        Cajero responsable: <span className="text-foreground font-bold">{data?.cut?.nombre_cajero || 'General'}</span> <span className="opacity-50 mx-1">•</span>
                        {data?.cut?.cut_date && new Date(data.cut.cut_date).toLocaleString('es-MX')}
                    </DialogDescription>

                    {/* Internal Tabs */}
                    <div className="flex gap-4 mt-6">
                        {['math', 'orders', 'expenses', 'digital'].map(tab => {
                            const labels = {
                                math: 'Arqueo & Matemática',
                                orders: 'Ventas en Efectivo',
                                expenses: 'Gastos Pagados',
                                digital: 'Tarjetas/Transferencias'
                            }
                            return (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={`relative pb-2 text-sm font-bold transition-colors ${activeTab === tab ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}
                                >
                                    {labels[tab]}
                                </button>
                            )
                        })}
                    </div>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto p-6 bg-card custom-scrollbar">
                    {isLoading ? (
                        <div className="py-20 flex justify-center"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>
                    ) : error ? (
                        <div className="py-20 text-center text-red-500 font-bold flex flex-col items-center">
                            <AlertCircle className="w-10 h-10 mb-2 text-red-500" /> No se pudo cargar el detalle.
                        </div>
                    ) : calculatedData && (
                        <>
                            {activeTab === 'math' && (
                                <div className="space-y-6 animate-in fade-in duration-300">
                                    <div className="bg-primary/5 border border-primary/20 rounded-2xl p-6">
                                        <h4 className="text-sm font-black text-primary flex items-center gap-2 mb-4 uppercase tracking-widest"><HelpCircle className="w-4 h-4" /> La Ecuación del Turno</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 text-center items-center">
                                            <div>
                                                <p className="text-xs text-muted-foreground font-bold mb-1">Fondo Inicial</p>
                                                <p className="text-2xl font-black text-foreground">{formatCurrency(calculatedData.fondo)}</p>
                                            </div>
                                            <div className="text-muted-foreground font-black text-lg">+</div>
                                            <div>
                                                <p className="text-xs text-muted-foreground font-bold mb-1">Entradas (Efectivo)</p>
                                                <p className="text-2xl font-black text-emerald-500">{formatCurrency(calculatedData.totalVentasEfectivo)}</p>
                                            </div>
                                            <div className="text-muted-foreground font-black text-lg">-</div>
                                            <div>
                                                <p className="text-xs text-muted-foreground font-bold mb-1">Salidas (Gastos)</p>
                                                <p className="text-2xl font-black text-orange-500">{formatCurrency(calculatedData.totalGastos)}</p>
                                            </div>
                                        </div>

                                        <div className="my-6 border-b border-primary/10 border-dashed" />

                                        <div className="flex items-center justify-center gap-8 text-center p-4 bg-background rounded-xl shadow-sm border border-border">
                                            <div>
                                                <p className="text-[10px] uppercase font-black tracking-widest text-muted-foreground mb-1">Sistema Esperaba</p>
                                                <p className="text-2xl font-black text-foreground opacity-70">=</p>
                                                <p className="text-3xl font-black text-foreground">{formatCurrency(calculatedData.esperado)}</p>
                                            </div>
                                            <div className="flex flex-col items-center justify-center opacity-40">
                                                <ArrowRight className="w-6 h-6 rotate-90 sm:rotate-0" />
                                            </div>
                                            <div>
                                                <p className="text-[10px] uppercase font-black tracking-widest text-primary mb-1">Cajero Declaró Contar</p>
                                                <div className={`text-2xl font-black ${calculatedData.diferencia < 0 ? 'text-red-500' : calculatedData.diferencia > 0 ? 'text-emerald-500' : 'text-emerald-600'}`}>
                                                    <p className="text-2xl font-black opacity-70">=</p>
                                                    <p className="text-3xl font-black">{formatCurrency(calculatedData.efectivoReal)}</p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="mt-6 flex justify-center">
                                            <div className={`px-6 py-3 rounded-full font-black flex items-center gap-2 ${calculatedData.diferencia < 0 ? 'bg-red-100 text-red-700 border border-red-200' : calculatedData.diferencia > 0 ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-primary/10 text-primary border border-primary/20'}`}>
                                                {calculatedData.diferencia < 0 ? <AlertCircle className="w-5 h-5" /> : <Banknote className="w-5 h-5" />}
                                                Resultado (Merma): {calculatedData.diferencia > 0 ? '+' : ''}{formatCurrency(calculatedData.diferencia)}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'orders' && (
                                <div className="space-y-3 animate-in fade-in duration-300">
                                    {calculatedData.cashOrders.length === 0 ? (
                                        <div className="text-center py-10 text-muted-foreground font-bold"><Receipt className="w-10 h-10 mx-auto mb-2 opacity-20" /> No hubo ventas en efectivo en este turno.</div>
                                    ) : (
                                        calculatedData.cashOrders.map(o => (
                                            <div key={o.id} className="flex items-center justify-between p-4 bg-background border border-border rounded-xl">
                                                <div>
                                                    <p className="font-black text-foreground">Folio: #{o.folio || o.id.slice(0, 6)}</p>
                                                    <p className="text-xs font-semibold text-muted-foreground mt-0.5">{new Date(o.created_at).toLocaleTimeString('es-MX')} • {o.order_type === 'delivery' ? 'Domicilio' : o.order_type === 'dine_in' ? 'Comedor' : 'Llevar'}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="font-black text-emerald-600 text-lg">+{formatCurrency(o.total)}</p>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}

                            {activeTab === 'expenses' && (
                                <div className="space-y-3 animate-in fade-in duration-300">
                                    {calculatedData.expenses.length === 0 ? (
                                        <div className="text-center py-10 text-muted-foreground font-bold"><ArrowDownCircle className="w-10 h-10 mx-auto mb-2 opacity-20" /> No hubo gastos registrados en este turno.</div>
                                    ) : (
                                        calculatedData.expenses.map(e => (
                                            <div key={e.id} className="flex items-center justify-between p-4 bg-background border border-orange-500/30 rounded-xl">
                                                <div>
                                                    <p className="font-black text-foreground">{e.descripcion}</p>
                                                    <p className="text-xs font-semibold text-muted-foreground mt-0.5">{new Date(e.created_at).toLocaleTimeString('es-MX')} • <span className="bg-muted px-1.5 py-0.5 rounded text-xs">{e.categoria}</span></p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="font-black text-orange-600 text-lg">-{formatCurrency(e.monto)}</p>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}

                            {activeTab === 'digital' && (
                                <div className="space-y-3 animate-in fade-in duration-300">
                                    <div className="mb-4 bg-muted p-3 rounded-lg border-l-4 border-blue-500 text-sm font-medium text-muted-foreground">
                                        Estas órdenes se pagaron por tarjeta o vinculación directa bancaria. El sistema asume que el dinero ingresó directamente a la cuenta de banco, por lo tanto <strong>NO afectan el conteo físico de los billetes</strong>.
                                    </div>
                                    {calculatedData.nonCashOrders.length === 0 ? (
                                        <div className="text-center py-10 text-muted-foreground font-bold"><XCircle className="w-10 h-10 mx-auto mb-2 opacity-20" /> No hubo ventas por tarjeta/transferencia en este turno.</div>
                                    ) : (
                                        calculatedData.nonCashOrders.map(o => (
                                            <div key={o.id} className="flex items-center justify-between p-4 bg-background border border-border rounded-xl opacity-70 hover:opacity-100 transition-opacity">
                                                <div>
                                                    <p className="font-black text-foreground">Folio: #{o.folio || o.id.slice(0, 6)} <span className="ml-2 uppercase tracking-widest text-[10px] bg-blue-100/50 text-blue-600 px-2 py-0.5 rounded-md font-bold">{o.payment_method === 'card' ? 'Tarjeta' : 'Transf'}</span></p>
                                                    <p className="text-xs font-semibold text-muted-foreground mt-0.5">{new Date(o.created_at).toLocaleTimeString('es-MX')} • {o.order_type === 'delivery' ? 'Domicilio' : o.order_type === 'dine_in' ? 'Comedor' : 'Llevar'}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="font-black text-foreground text-lg">{formatCurrency(o.total)}</p>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
