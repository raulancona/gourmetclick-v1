import { useQuery } from '@tanstack/react-query'
import { getActiveSession } from '../lib/order-service'
import { useTenant } from '../features/auth/tenant-context'

/**
 * Hook to track the currently active cash session
 * Useful for blocking UI elements or forcing a shift start
 */
export function useActiveSession() {
    const { tenant } = useTenant()

    const {
        data: session,
        isLoading,
        refetch,
        isError,
        error
    } = useQuery({
        queryKey: ['active-session', tenant?.id],
        queryFn: () => getActiveSession(tenant.id),
        enabled: !!tenant?.id,
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
