import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

const AuthContext = createContext({})

export const useAuth = () => {
    const context = useContext(AuthContext)
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider')
    }
    return context
}

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null)
    const [profile, setProfile] = useState(null)
    const [loading, setLoading] = useState(true)

    const loadProfileFromSession = (sessionUser) => {
        if (!sessionUser) {
            setProfile(null)
            return
        }

        // Extraer rol directamente del metadata del JWT (Phase 2/4)
        const role = sessionUser.app_metadata?.role || 'staff'
        setProfile({
            id: sessionUser.id,
            role: role
        })
    }

    useEffect(() => {
        const initSession = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession()
                const currentUser = session?.user ?? null
                setUser(currentUser)
                loadProfileFromSession(currentUser)
            } catch (err) {
                console.error('Error in initSession:', err)
            } finally {
                setLoading(false)
            }
        }

        initSession()

        // Listen for auth changes
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange(async (_event, session) => {
            try {
                const currentUser = session?.user ?? null
                setUser(currentUser)
                loadProfileFromSession(currentUser)
            } catch (err) {
                console.error('Error in onAuthStateChange:', err)
            } finally {
                setLoading(false)
            }
        })

        return () => subscription.unsubscribe()
    }, [])

    const signIn = async (email, password) => {
        try {
            setLoading(true)
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            })
            if (error) throw error
            return data
        } finally {
            setLoading(false)
        }
    }

    const signUp = async (email, password) => {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
        })
        if (error) throw error
        return data
    }

    const signOut = async () => {
        setProfile(null)
        setUser(null)
        const { error } = await supabase.auth.signOut()
        if (error) throw error
    }

    const value = {
        user,
        profile,
        loading,
        signIn,
        signUp,
        signOut,
    }

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
