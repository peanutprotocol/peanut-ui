import { type IUserProfile } from '@/interfaces'
import { useAppDispatch, useUserStore } from '@/redux/hooks'
import { userActions } from '@/redux/slices/user-slice'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { useQuery } from '@tanstack/react-query'
import { usePWAStatus } from '../usePWAStatus'
import { useDeviceType } from '../useGetDeviceType'
import { USER } from '@/constants/query.consts'
import { apiFetch } from '@/utils/api-fetch'

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
        const userResponse = await apiFetch('/get-user', '/api/peanut/user/get-user-from-cookie', {
            method: 'POST',
            body: JSON.stringify({}),
        })
        if (userResponse.ok) {
            const userData: IUserProfile | null = await userResponse.json()
            if (userData) {
                // Was: hitUserMetric(userData.user.userId, 'login', ...) → POST /users/:id/metrics/login.
                // DB `user_metrics` table deprecated 2026-04-24; analytics is PostHog's job.
                posthog.capture(ANALYTICS_EVENTS.LOGIN, { isPwa, deviceType })
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
        retry: (failureCount, _error) => {
            // retry all errors (5xx, network timeouts, connection failures) up to 2 times
            // previously only BackendError (5xx) was retried, meaning a single network
            // blip would instantly show the BackendErrorScreen with zero retries
            return failureCount < 2
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
