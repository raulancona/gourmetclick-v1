import { useQueryClient } from '@tanstack/react-query'
import { useRealtimeSubscription } from '../features/realtime/realtime-context'

export function useCategorySubscription(_userId) {
    const queryClient = useQueryClient()

    useRealtimeSubscription('categories', (payload) => {
        console.log('Category change received!', payload)
        queryClient.invalidateQueries(['categories'])
    })
}
