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

                    // Fallback: user is staff/cashier — resolve via restaurant_access
                    const { data: access, error: accessError } = await supabase
                        .from('restaurant_access')
                        .select('restaurant_id, role')
                        .eq('user_id', user.id)
                        .limit(1)
                        .maybeSingle()

                    if (accessError) throw accessError

                    if (access?.restaurant_id) {
                        const { data: restaurant, error: restaurantError } = await supabase
                            .from('restaurants')
                            .select('id, name, slug')
                            .eq('id', access.restaurant_id)
                            .single()

                        if (restaurantError) throw restaurantError

                        if (restaurant) {
                            setTenant({
                                id: restaurant.id,
                                name: restaurant.name,
                                slug: restaurant.slug,
                                role: access.role
                            })
                            clearTimeout(timeout)
                            setLastFetchedUserId(user.id)
                            setLoading(false)
                            return
                        }
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

            // Priority 3: PIN-based terminal session — read from localStorage employee session
            // (set by terminal-context at login time with restaurant_slug and restaurante_id)
            try {
                const savedSession = localStorage.getItem('pos_session')
                if (savedSession) {
                    const employeeSession = JSON.parse(savedSession)
                    if (employeeSession?.restaurante_id && employeeSession?.restaurant_slug) {
                        setTenant({
                            id: employeeSession.restaurante_id,
                            name: employeeSession.restaurant_name || '',
                            slug: employeeSession.restaurant_slug,
                            role: employeeSession.rol || 'cajero'
                        })
                        setLoading(false)
                        return
                    }
                }
            } catch (err) {
                console.error('Error reading terminal session from localStorage:', err)
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
