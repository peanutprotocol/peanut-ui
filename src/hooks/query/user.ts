import { USER } from '@/constants'
import { type IUserProfile } from '@/interfaces'
import { useAppDispatch, useUserStore } from '@/redux/hooks'
import { userActions } from '@/redux/slices/user-slice'
import { fetchWithSentry } from '@/utils'
import { hitUserMetric } from '@/utils/metrics.utils'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { usePWAStatus } from '../usePWAStatus'
import { useDeviceType } from '../useGetDeviceType'

export const useUserQuery = (dependsOn?: boolean) => {
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
        } else {
            // RECOVERY FIX: Log error status for debugging
            if (userResponse.status === 400 || userResponse.status === 500) {
                console.error('Failed to fetch user with error status:', userResponse.status)
                // This indicates a backend issue - user might be in broken state
                // The KernelClientProvider recovery logic will handle cleanup
            } else {
                console.warn('Failed to fetch user. Probably not logged in.')
            }
            return null
        }
    }

    return useQuery({
        queryKey: [USER],
        queryFn: fetchUser,
        retry: 0,
        // OFFLINE: Service Worker will cache the API response for instant loads
        // staleTime: 0 ensures we always check SW cache first (10-50ms response)
        // SW uses StaleWhileRevalidate: instant cache response + background update
        enabled: dependsOn && !authUser?.user.userId,
        // Always check SW cache on mount for offline support
        staleTime: 0,
        // refetch only when window is focused if data is stale
        refetchOnWindowFocus: true,
        // Always refetch on mount to trigger SW cache check
        refetchOnMount: true,
        // add initial data from Redux if available
        initialData: authUser || undefined,
        // keep previous data
        placeholderData: keepPreviousData,
    })
}
