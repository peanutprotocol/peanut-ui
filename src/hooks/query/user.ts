import { USER } from '@/constants'
import { IUserProfile } from '@/interfaces'
import { useAppDispatch, useUserStore } from '@/redux/hooks'
import { userActions } from '@/redux/slices/user-slice'
import { fetchWithSentry } from '@/utils'
import { hitUserMetric } from '@/utils/metrics.utils'
import { useQuery } from '@tanstack/react-query'
import { usePWAStatus } from '../usePWAStatus'

export const useUserQuery = (dependsOn?: boolean) => {
    const isPwa = usePWAStatus()
    const dispatch = useAppDispatch()
    const { user: authUser } = useUserStore()

    const fetchUser = async (): Promise<IUserProfile | null> => {
        const userResponse = await fetchWithSentry('/api/peanut/user/get-user-from-cookie')
        if (userResponse.ok) {
            const userData: IUserProfile | null = await userResponse.json()
            if (userData) {
                hitUserMetric(userData.user.userId, 'login', { isPwa: isPwa })

                dispatch(userActions.setUser(userData))
            }

            return userData
        } else {
            console.warn('Failed to fetch user. Probably not logged in.')
            return null
        }
    }

    return useQuery({
        queryKey: [USER],
        queryFn: fetchUser,
        retry: 0,
        // only enable the query if:
        // 1. dependsOn is true
        // 2. no user is currently in the Redux store
        enabled: dependsOn && !authUser?.user.userId,
        // cache the data for 10 minutes
        staleTime: 1000 * 60 * 10,
        // refetch only when window is focused if data is stale
        refetchOnWindowFocus: true,
        // prevent unnecessary refetches
        refetchOnMount: false,
        // add initial data from Redux if available
        initialData: authUser || undefined,
    })
}
