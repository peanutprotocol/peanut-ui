import { type IUserProfile } from '@/interfaces'
import { useAppDispatch, useUserStore } from '@/redux/hooks'
import { userActions } from '@/redux/slices/user-slice'
import { fetchWithSentry } from '@/utils/sentry.utils'
import { hitUserMetric } from '@/utils/metrics.utils'
import { useQuery } from '@tanstack/react-query'
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

        // 4xx = auth failure, clear stale redux so layout redirects to /setup
        console.warn('Failed to fetch user, status:', userResponse.status)
        dispatch(userActions.setUser(null))
        return null
    }

    return useQuery({
        queryKey: [USER],
        queryFn: fetchUser,
        retry: (failureCount, error) => {
            if (error instanceof BackendError && failureCount < 2) return true
            return false
        },
        retryDelay: 1000,
        enabled: dependsOn,
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
        refetchOnMount: true,
        refetchOnWindowFocus: true,
        placeholderData: authUser || undefined,
    })
}
