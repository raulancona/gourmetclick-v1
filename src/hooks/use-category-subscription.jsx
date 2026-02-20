import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export function useCategorySubscription(userId) {
    const queryClient = useQueryClient()

    useEffect(() => {
        if (!userId) return

        const channel = supabase
            .channel(`category-changes-${userId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'categories',
                    filter: `user_id=eq.${userId}`
                },
                (payload) => {
                    console.log('Category change received!', payload)
                    queryClient.invalidateQueries(['categories'])
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [userId, queryClient])
}
