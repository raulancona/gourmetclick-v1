import { createContext, useContext, useEffect, useState, useRef } from 'react'
import { useLocation, matchPath } from 'react-router-dom'
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
    const [lastFetchedUserId, setLastFetchedUserId] = useState(null)
    const isFetchingRef = useRef(false)
    const location = useLocation()

    useEffect(() => {
        const fetchTenant = async () => {
            if (isFetchingRef.current) return;
            isFetchingRef.current = true;
            // Priority 1: If we have an authenticated owner/admin
            if (user && profile) {
                // Prevent infinite loop if tenant is already resolved for the given session user
                if (tenant && lastFetchedUserId === user.id) {
                    setLoading(false)
                    return
                }

                const timeout = setTimeout(() => {
                    setLoading(false)
                }, 5000)

                try {
                    const { data, error } = await supabase
                        .from('restaurants')
                        .select('id, name, slug')
                        .eq('owner_id', user.id)
                        .limit(1)
                        .maybeSingle()

                    if (error) throw error

                    if (data) {
                        setTenant({
                            id: data.id,
                            name: data.name,
                            slug: data.slug,
                            role: profile.role
                        })
                        clearTimeout(timeout)
                        setLastFetchedUserId(user.id)
                        setLoading(false)
                        return
                    }
                } catch (err) {
                    console.error('Error fetching tenant for user:', err)
                } finally {
                    clearTimeout(timeout)
                }
            }

            // Priority 2: If we are in a public route with a slug (Terminal Access / Menu)
            let slug = null;
            const terminalMatch = matchPath({ path: "/t/:slug" }, location.pathname);
            const menuMatch = matchPath({ path: "/menu/:slug" }, location.pathname);
            const mMatch = matchPath({ path: "/m/:slug" }, location.pathname);

            if (terminalMatch) slug = terminalMatch.params.slug;
            else if (menuMatch) slug = menuMatch.params.slug;
            else if (mMatch) slug = mMatch.params.slug;

            if (slug) {
                try {
                    const { data, error } = await supabase
                        .from('restaurants')
                        .select('id, name, slug')
                        .eq('slug', slug)
                        .single()

                    if (data) {
                        setTenant({
                            id: data.id,
                            name: data.name,
                            slug: data.slug,
                            role: 'public' // Default for non-auth sessions
                        })
                        setLoading(false)
                        return
                    }
                } catch (err) {
                    console.error('Error fetching tenant by slug:', err)
                }
            }

            setTenant(null)
            setLastFetchedUserId(user?.id || null)
            setLoading(false)
        }

        if (!authLoading) {
            fetchTenant().finally(() => {
                isFetchingRef.current = false;
            })
        }
    }, [user, profile, authLoading, location.pathname])

    // Prevent immediate redirect in ProtectedRoute when user updates but tenant hasn't yet finished resolving
    const isFetchingForUser = user && lastFetchedUserId !== user.id;

    const value = {
        tenant,
        loading: loading || authLoading || isFetchingForUser
    }

    return (
        <TenantContext.Provider value={value}>
            {children}
        </TenantContext.Provider>
    )
}
