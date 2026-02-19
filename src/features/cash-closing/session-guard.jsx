import { useActiveSession } from '../../hooks/use-active-session'
import { OpenSession } from '../cash-closing/open-session'
import { Loader2 } from 'lucide-react'

/**
 * SessionGuard protects children components (like POS or Orders)
 * by requiring an active cash session. If no session is active,
 * it renders the OpenSession view.
 */
export function SessionGuard({ children }) {
    const { session, hasActiveSession, isLoading, refetch } = useActiveSession()

    if (isLoading) {
        return (
            <div className="flex h-[60vh] items-center justify-center">
                <div className="text-center space-y-4">
                    <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
                    <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">
                        Verificando Estado de Caja...
                    </p>
                </div>
            </div>
        )
    }

    if (!hasActiveSession) {
        return (
            <div className="p-8">
                <div className="max-w-4xl mx-auto space-y-8">
                    <div className="text-center space-y-2">
                        <h2 className="text-3xl font-black tracking-tight text-foreground">Turno Cerrado</h2>
                        <p className="text-muted-foreground font-medium">Debes abrir la caja con un fondo inicial para comenzar a operar.</p>
                    </div>
                    <OpenSession onComplete={() => refetch()} />
                </div>
            </div>
        )
    }

    // Pass the session down if needed or just render children
    return children
}
