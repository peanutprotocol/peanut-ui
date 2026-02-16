import { type IUserProfile } from '@/interfaces'
import { useAppDispatch, useUserStore } from '@/redux/hooks'
import { userActions } from '@/redux/slices/user-slice'
import { fetchWithSentry } from '@/utils/sentry.utils'
import { hitUserMetric } from '@/utils/metrics.utils'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { usePWAStatus } from '../usePWAStatus'
import { useDeviceType } from '../useGetDeviceType'
import { USER } from '@/constants/query.consts'

// custom error class for backend errors (5xx) that should trigger retry
export class BackendError extends Error {
    status: number
    constructor(message: string, status: number) {
        super(message)
        this.name = 'BackendError'
        this.status = status
    }
}

export const useUserQuery = (dependsOn: boolean = true) => {
    const isPwa = usePWAStatus()
    const { deviceType } = useDeviceType()
    const dispatch = useAppDispatch()
    const { user: authUser } = useUserStore()

    const fetchUser = async (): Promise<IUserProfile | null> => {
        const userResponse = await fetchWithSentry('/api/peanut/user/get-user-from-cookie')
        if (userResponse.ok) {
            const userData: IUserProfile | null = await userResponse.json()
            if (userData) {
                hitUserMetric(userData.user.userId, 'login', {
                    isPwa: isPwa,
                    deviceType: deviceType,
                })

                dispatch(userActions.setUser(userData))
            }

            return userData
        }

        // 5xx = backend error, throw so tanstack retries
        if (userResponse.status >= 500) {
            console.error('Backend error fetching user:', userResponse.status)
            throw new BackendError('Backend error fetching user', userResponse.status)
        }

        // 4xx = auth failure (not logged in, invalid token, etc), return null
        console.warn('Failed to fetch user (status %d). Probably not logged in.', userResponse.status)
        return null
    }

    return useQuery({
        queryKey: [USER],
        queryFn: fetchUser,
        // retry 5xx errors up to 2 times with 1s delay
        retry: (failureCount, error) => {
            if (error instanceof BackendError && failureCount < 2) {
                return true
            }
            return false
        },
        retryDelay: 1000,
        // Enable if dependsOn is true (defaults to true) and no Redux user exists yet
        enabled: dependsOn && !authUser?.user.userId,
        // Two-tier caching strategy for optimal performance:
        // TIER 1: TanStack Query in-memory cache (5 min)
        //   - Zero latency for active sessions
        //   - Lost on page refresh (intentional - forces SW cache check)
        // TIER 2: Service Worker disk cache (1 week StaleWhileRevalidate)
        //   - <50ms response on cold start/offline
        //   - Persists across sessions
        // Flow: TQ cache → if stale → fetch() → SW intercepts → SW cache → Network
        staleTime: 5 * 60 * 1000, // 5 min (balance: fresh enough + reduces SW hits)
        gcTime: 10 * 60 * 1000, // Keep unused data 10 min before garbage collection
        // Refetch on mount - TQ automatically skips if data is fresh (< staleTime)
        refetchOnMount: true,
        // Refetch on focus - TQ automatically skips if data is fresh (< staleTime)
        refetchOnWindowFocus: true,
        // Initialize with Redux data if available (hydration)
        initialData: authUser || undefined,
        // Keep previous data during refetch (smooth UX, no flicker)
        placeholderData: keepPreviousData,
    })
}
