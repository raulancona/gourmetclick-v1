import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from './auth-context'
import { useTenant } from './tenant-context'
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
    const { tenant } = useTenant()
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
        if (!tenant) throw new Error('Cargando restaurante...')

        const { data: result, error } = await supabase.rpc('validate_terminal_pin', {
            p_slug: tenant.slug,
            p_pin: pin
        })

        if (error) {
            console.error('RPC Error:', error)
            throw new Error('Error al validar acceso')
        }

        if (!result.success) {
            throw new Error(result.message)
        }

        const employeeData = result.data
        const sessionData = {
            id: employeeData.id,
            nombre: employeeData.nombre,
            rol: employeeData.rol,
            restaurante_id: employeeData.restaurante_id
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
