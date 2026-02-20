import { createContext, useContext, useEffect, useState } from 'react'
import { useAuth } from './auth-context'
import { supabase } from '../../lib/supabase'

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
    const { user, profile, loading: authLoading } = useAuth()
    const [tenant, setTenant] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchTenant = async () => {
            if (!user || !profile) {
                setTenant(null)
                setLoading(false)
                return
            }

            // Timeout de seguridad
            const timeout = setTimeout(() => {
                setLoading(false)
            }, 5000)

            try {
                // Fetch the first restaurant the user has access to
                const { data, error } = await supabase
                    .from('restaurants')
                    .select('id, name')
                    .limit(1)
                    .maybeSingle()

                if (error) throw error

                if (data) {
                    setTenant({
                        id: data.id,
                        name: data.name,
                        role: profile.role
                    })
                } else {
                    // Fallback para usuarios legacy que no tienen registro en "restaurants"
                    setTenant({
                        id: user.id,
                        name: profile.name || 'Mi Restaurante',
                        role: profile.role
                    })
                }
            } catch (err) {
                console.error('Error fetching tenant:', err)
            } finally {
                clearTimeout(timeout)
                setLoading(false)
            }
        }

        if (!authLoading) {
            fetchTenant()
        }
    }, [user, profile, authLoading])

    const value = {
        tenant,
        loading: loading || authLoading
    }

    return (
        <TenantContext.Provider value={value}>
            {children}
        </TenantContext.Provider>
    )
}
