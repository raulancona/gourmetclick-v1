import { useQuery } from '@tanstack/react-query'
import { getActiveSession } from '../lib/session-service'
import { useTenant } from '../features/auth/tenant-context'
import { useTerminal } from '../features/auth/terminal-context'

/**
 * Hook to track the currently active cash session.
 * Falls back to activeEmployee.restaurante_id for PIN-based terminal sessions
 * where tenant may be null (e.g., on /pos after navigating from /t/:slug).
 */
export function useActiveSession() {
    const { tenant } = useTenant()
    const { activeEmployee } = useTerminal()

    const restaurantId = tenant?.id || activeEmployee?.restaurante_id

    const {
        data: session,
        isLoading,
        refetch,
        isError,
        error
    } = useQuery({
        queryKey: ['active-session', restaurantId],
        queryFn: () => getActiveSession(restaurantId),
        enabled: !!restaurantId,
        staleTime: 1000 * 60 * 5, // 5 minutes
        retry: 1
    })

    return {
        session,
        hasActiveSession: !!session,
        isLoading,
        refetch,
        isError,
        error
    }
}
