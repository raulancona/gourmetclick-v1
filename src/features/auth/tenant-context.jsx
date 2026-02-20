import { createContext, useContext, useMemo } from 'react'
import { useAuth } from './auth-context'

const TenantContext = createContext({
    tenant: null,
    loading: true
})

export const useTenant = () => {
    const context = useContext(TenantContext)
    if (!context) {
        throw new Error('useTenant must be used within TenantProvider')
    }
    return context
}

export function TenantProvider({ children }) {
    const { user, loading: authLoading } = useAuth()

    const tenant = useMemo(() => {
        if (!user) return null
        return {
            id: user.id,
            email: user.email,
            // Future: Fetch restaurant details from DB using user.id
            // For now, user.id IS the tenant ID (Owner-based model)
        }
    }, [user])

    const value = {
        tenant,
        loading: authLoading
    }

    return (
        <TenantContext.Provider value={value}>
            {children}
        </TenantContext.Provider>
    )
}
