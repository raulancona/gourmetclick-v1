import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from './auth-context'
import { useNavigate } from 'react-router-dom'

const TerminalContext = createContext({})

export const useTerminal = () => {
    const context = useContext(TerminalContext)
    if (!context) {
        throw new Error('useTerminal must be used within TerminalProvider')
    }
    return context
}

export function TerminalProvider({ children }) {
    const { user } = useAuth()
    const navigate = useNavigate()
    const [activeEmployee, setActiveEmployee] = useState(() => {
        const saved = localStorage.getItem('pos_session')
        return saved ? JSON.parse(saved) : null
    })

    useEffect(() => {
        if (activeEmployee) {
            localStorage.setItem('pos_session', JSON.stringify(activeEmployee))
        } else {
            localStorage.removeItem('pos_session')
        }
    }, [activeEmployee])

    const login = async (pin) => {
        if (!user) throw new Error('Usuario no autenticado')

        const { data, error } = await supabase
            .from('empleados')
            .select('*')
            .eq('restaurante_id', user.id)
            .eq('pin', pin)
            .eq('activo', true)
            .single()

        if (error || !data) {
            throw new Error('PIN incorrecto o usuario inactivo')
        }

        const sessionData = {
            id: data.id,
            nombre: data.nombre,
            rol: data.rol
        }

        setActiveEmployee(sessionData)
        return sessionData
    }

    const logout = () => {
        setActiveEmployee(null)
        navigate('/terminal')
    }

    const value = {
        activeEmployee,
        login,
        logout,
        isAuthenticated: !!activeEmployee
    }

    return (
        <TerminalContext.Provider value={value}>
            {children}
        </TerminalContext.Provider>
    )
}
