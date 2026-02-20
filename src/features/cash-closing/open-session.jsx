import { useState } from 'react'
import { LayoutPanelLeft, Loader2, Play } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { toast } from 'sonner'
import { openSession } from '../../lib/order-service'
import { useAuth } from '../auth/auth-context'
import { useTerminal } from '../auth/terminal-context'
import { useTenant } from '../auth/tenant-context'

export function OpenSession({ onComplete }) {
    const { user } = useAuth()
    const { tenant } = useTenant()
    const { activeEmployee } = useTerminal()
    const [fondoInicial, setFondoInicial] = useState('')
    const [isLoading, setIsLoading] = useState(false)

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!fondoInicial || parseFloat(fondoInicial) < 0) {
            toast.error('Ingresa un monto válido para el fondo inicial')
            return
        }

        try {
            setIsLoading(true)
            await openSession(tenant.id, activeEmployee?.id || null, fondoInicial)
            toast.success('Sesión de caja abierta con éxito')
            if (onComplete) onComplete()
        } catch (error) {
            console.error('Error opening session:', error)
            toast.error('Error al abrir la sesión: ' + error.message)
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="max-w-md mx-auto">
            <div className="bg-card rounded-[2.5rem] border border-border shadow-2xl overflow-hidden">
                <div className="bg-gradient-to-br from-indigo-600 to-blue-700 p-10 text-white text-center relative overflow-hidden">
                    <LayoutPanelLeft className="w-32 h-32 absolute -bottom-8 -right-8 opacity-10 rotate-12" />
                    <div className="mx-auto w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mb-4 backdrop-blur-md">
                        <Play className="w-8 h-8 fill-current" />
                    </div>
                    <h2 className="text-3xl font-black mb-1 uppercase tracking-tight">Abrir Caja</h2>
                    <p className="text-sm font-medium opacity-80">Indica el fondo inicial para este turno</p>
                </div>

                <form onSubmit={handleSubmit} className="p-10 space-y-8">
                    <div className="space-y-4">
                        <Label htmlFor="fondoInicial" className="text-xs font-black uppercase text-muted-foreground tracking-widest text-center block">
                            Dinero Base (Fondo Inicial)
                        </Label>
                        <div className="relative">
                            <span className="absolute left-6 top-1/2 -translate-y-1/2 text-3xl font-black text-muted-foreground">$</span>
                            <Input
                                id="fondoInicial"
                                type="number"
                                step="0.01"
                                value={fondoInicial}
                                onChange={(e) => setFondoInicial(e.target.value)}
                                className="h-24 text-5xl font-black text-center pl-12 bg-muted/30 border-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-3xl"
                                placeholder="0.00"
                                autoFocus
                                required
                            />
                        </div>
                    </div>

                    <div className="bg-indigo-50 dark:bg-indigo-950/20 p-4 rounded-2xl border border-indigo-100 dark:border-indigo-900/50">
                        <p className="text-[11px] text-indigo-700 dark:text-indigo-400 font-bold leading-tight">
                            Este monto se sumará a las ventas del día para calcular el balance final esperado al cerrar el turno.
                        </p>
                    </div>

                    <Button
                        type="submit"
                        className="w-full h-18 rounded-[2rem] text-xl font-black shadow-xl shadow-indigo-500/20 bg-indigo-600 hover:bg-indigo-700 transition-all hover:scale-[1.02] active:scale-95"
                        disabled={isLoading}
                    >
                        {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : 'INICIAR TURNO'}
                    </Button>
                </form>
            </div>
        </div>
    )
}
