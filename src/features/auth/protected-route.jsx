import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './auth-context'
import { useTenant } from './tenant-context'
import { useTerminal } from './terminal-context'
import { toast } from 'sonner'
import { useEffect } from 'react'

export function ProtectedRoute({ children }) {
    const { user, loading: authLoading } = useAuth()
    const { tenant, loading: tenantLoading } = useTenant()
    const { activeEmployee } = useTerminal()
    const location = useLocation()

    // Rutas restringidas para empleados no-admin
    const restrictedRoutes = ['/dashboard', '/settings', '/inventory', '/products', '/staff']

    useEffect(() => {
        if (activeEmployee && activeEmployee.rol !== 'admin') {
            const isRestricted = restrictedRoutes.some(route => location.pathname.startsWith(route))
            if (isRestricted) {
                toast.error('Acceso denegado: Se requieren permisos de administrador')
            }
        }
    }, [activeEmployee, location.pathname])

    if (authLoading || tenantLoading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <div className="text-muted-foreground">Cargando...</div>
            </div>
        )
    }

    if (!user && !activeEmployee) {
        return <Navigate to="/login" replace />
    }

    // Authenticated but no restaurant configured → onboarding
    if (user && !tenant && !activeEmployee && location.pathname !== '/onboarding') {
        return <Navigate to="/onboarding" replace />
    }

    // Si hay un empleado logueado Y NO es admin, verificar ruta
    if (activeEmployee && activeEmployee.rol !== 'admin') {
        const isRestricted = restrictedRoutes.some(route => location.pathname.startsWith(route))
        if (isRestricted) {
            return <Navigate to="/pos" replace />
        }
    }

    return children
}
