import { Navigate } from 'react-router-dom'
import { useAuth } from './auth-context'

export function ProtectedRoute({ children }) {
    const { user, loading } = useAuth()

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <div className="text-muted-foreground">Cargando...</div>
            </div>
        )
    }

    if (!user) {
        return <Navigate to="/login" replace />
    }

    return children
}
