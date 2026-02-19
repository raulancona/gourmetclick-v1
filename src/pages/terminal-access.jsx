import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTerminal } from '../features/auth/terminal-context'
import { ChefHat, Delete, Lock, ShieldAlert, Loader2 } from 'lucide-react'
import { Button } from '../components/ui/button'
import { toast } from 'sonner'

export function TerminalAccessPage() {
    const [pin, setPin] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const { login, isAuthenticated, activeEmployee } = useTerminal()
    const navigate = useNavigate()

    useEffect(() => {
        if (isAuthenticated && activeEmployee) {
            handleRedirection(activeEmployee.rol)
        }
    }, [isAuthenticated, activeEmployee])

    const handleRedirection = (rol) => {
        if (rol === 'mesero' || rol === 'cajero') navigate('/pos')
        else navigate('/dashboard')
    }

    const handleNumberClick = (num) => {
        if (pin.length < 4) {
            const newPin = pin + num
            setPin(newPin)
            if (newPin.length === 4) {
                handleLogin(newPin)
            }
        }
    }

    const handleDelete = () => {
        setPin(pin.slice(0, -1))
    }

    const handleLogin = async (finalPin) => {
        try {
            setIsLoading(true)
            const employee = await login(finalPin)
            toast.success(`Bienvenido, ${employee.nombre}`)
            handleRedirection(employee.rol)
        } catch (error) {
            toast.error(error.message)
            setPin('')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
            <div className="max-w-xs w-full space-y-8">
                {/* Header */}
                <div className="text-center space-y-4">
                    <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mx-auto shadow-inner">
                        <ChefHat className="w-10 h-10" />
                    </div>
                    <div className="space-y-1">
                        <h1 className="text-2xl font-black text-foreground tracking-tight uppercase">Terminal POS</h1>
                        <p className="text-muted-foreground font-bold text-[10px] uppercase tracking-widest">Ingresa tu PIN de acceso</p>
                    </div>
                </div>

                {/* PIN Display */}
                <div className="flex justify-center gap-4 py-8">
                    {[0, 1, 2, 3].map((idx) => (
                        <div
                            key={idx}
                            className={`w-4 h-4 rounded-full transition-all duration-300 ${pin.length > idx
                                ? 'bg-primary scale-125 shadow-[0_0_15px_rgba(var(--primary),0.5)]'
                                : 'bg-muted-foreground/30'
                                }`}
                        />
                    ))}
                </div>

                {/* Numpad */}
                <div className="grid grid-cols-3 gap-4">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                        <Button
                            key={num}
                            variant="outline"
                            className="h-20 text-3xl font-black rounded-2xl bg-card border-none hover:bg-primary hover:text-primary-foreground shadow-sm transition-all active:scale-95"
                            onClick={() => handleNumberClick(num.toString())}
                            disabled={isLoading}
                        >
                            {num}
                        </Button>
                    ))}
                    <div /> {/* Spacer */}
                    <Button
                        variant="outline"
                        className="h-20 text-3xl font-black rounded-2xl bg-card border-none hover:bg-primary hover:text-primary-foreground shadow-sm transition-all active:scale-95"
                        onClick={() => handleNumberClick('0')}
                        disabled={isLoading}
                    >
                        0
                    </Button>
                    <Button
                        variant="ghost"
                        className="h-20 text-2xl font-black rounded-2xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                        onClick={handleDelete}
                        disabled={isLoading || pin.length === 0}
                    >
                        <Delete className="w-8 h-8" />
                    </Button>
                </div>

                {/* Security Note */}
                <div className="flex items-center justify-center gap-2 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                    <Lock className="w-3 h-3" />
                    Acceso Restringido
                </div>

                {isLoading && (
                    <div className="fixed inset-0 bg-background/50 flex items-center justify-center z-50 backdrop-blur-sm">
                        <Loader2 className="w-10 h-10 text-primary animate-spin" />
                    </div>
                )}
            </div>
        </div>
    )
}
