import { type IUserProfile } from '@/interfaces'
import { useAppDispatch, useUserStore } from '@/redux/hooks'
import { userActions } from '@/redux/slices/user-slice'
import { fetchWithSentry } from '@/utils/sentry.utils'
import { hitUserMetric } from '@/utils/metrics.utils'
import { useQuery } from '@tanstack/react-query'
import { usePWAStatus } from '../usePWAStatus'
import { useDeviceType } from '../useGetDeviceType'
import { USER } from '@/constants/query.consts'

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
        } else {
            console.warn('Failed to fetch user, status:', userResponse.status)
            // clear stale redux data so the app doesn't keep serving cached user
            dispatch(userActions.setUser(null))
            return null
        }
    }

    return useQuery({
        queryKey: [USER],
        queryFn: fetchUser,
        retry: 0,
        enabled: dependsOn,
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
        refetchOnMount: true,
        refetchOnWindowFocus: true,
        // use redux data as placeholder while fetching (no flicker)
        // but always validate against the backend
        placeholderData: authUser || undefined,
    })
}
