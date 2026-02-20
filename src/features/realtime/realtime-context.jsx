import { createContext, useContext, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useTenant } from '../auth/tenant-context'
import { toast } from 'sonner'

const RealtimeContext = createContext({})

export function RealtimeProvider({ children }) {
    const { tenant } = useTenant()
    const channelRef = useRef(null)
    const subscribersRef = useRef({})

    // Subscribe function for components to register callbacks
    const subscribeToTable = (table, callback) => {
        if (!subscribersRef.current[table]) {
            subscribersRef.current[table] = []
        }
        subscribersRef.current[table].push(callback)

        // Return unsubscribe function
        return () => {
            if (subscribersRef.current[table]) {
                subscribersRef.current[table] = subscribersRef.current[table].filter(cb => cb !== callback)
            }
        }
    }

    useEffect(() => {
        // We only connect if we have a tenant
        if (!tenant?.id) {
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current)
                channelRef.current = null
            }
            return
        }

        // 1. Clean up existing channel if any
        if (channelRef.current) {
            supabase.removeChannel(channelRef.current)
        }

        console.log('🔌 Establishing Global Realtime Connection for Tenant:', tenant.id)

        // 2. Create Single Multiplexed Channel
        const channel = supabase.channel(`global-tenant-${tenant.id}`)

        // 3. Bind Listeners for Key Tables
        const tables = ['products', 'categories', 'orders', 'order_items', 'sesiones_caja']

        tables.forEach(table => {
            channel.on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: table,
                    filter: `user_id=eq.${tenant.id}`
                },
                (payload) => {
                    console.log(`⚡ Realtime Event [${table}]:`, payload.eventType)

                    // Notify subscribers
                    if (subscribersRef.current[table]) {
                        subscribersRef.current[table].forEach(callback => callback(payload))
                    }
                }
            )
        })

        // 4. Subscribe
        channel.subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                console.log('✅ Global Realtime Connected')
            } else if (status === 'CHANNEL_ERROR') {
                console.error('❌ Realtime Connection Error')
            }
        })

        channelRef.current = channel

        return () => {
            console.log('🔌 Disconnecting Global Realtime...')
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current)
            }
        }
    }, [tenant?.id])

    return (
        <RealtimeContext.Provider value={{ subscribeToTable }}>
            {children}
        </RealtimeContext.Provider>
    )
}

export const useRealtime = () => useContext(RealtimeContext)

export function useRealtimeSubscription(table, callback) {
    const { subscribeToTable } = useRealtime() || {}

    useEffect(() => {
        if (!subscribeToTable) return

        const unsubscribe = subscribeToTable(table, callback)
        return () => {
            unsubscribe()
        }
    }, [table, callback, subscribeToTable])
}
