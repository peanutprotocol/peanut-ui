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
import { clearAuthToken, setAuthToken } from '@/utils/auth-token'
import { isDemoMode } from '@/utils/demo'
import { DEMO_USER } from '@/constants/demo-data'

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
        // Demo mode: no backend/JWT/passkey — return the synthetic user.
        if (isDemoMode()) {
            dispatch(userActions.setUser(DEMO_USER))
            return DEMO_USER
        }

        const userResponse = await apiFetch('/users/me', { method: 'GET' })
        if (userResponse.ok) {
            const payload: (IUserProfile & { token?: string }) | null = await userResponse.json()

            // Sliding refresh: backend re-mints when the JWT crosses half its
            // lifetime and ships the new one alongside the user payload. Swap
            // it in client-side so active users never hit the 30d hard logout.
            // Strip `token` unconditionally so auth state never leaks into the
            // user store, even if the backend ever sends a falsy value.
            if (payload && 'token' in payload) {
                if (payload.token) setAuthToken(payload.token)
                delete payload.token
            }

            if (payload) {
                // Was: hitUserMetric(userData.user.userId, 'login', ...) → POST /users/:id/metrics/login.
                // DB `user_metrics` table deprecated 2026-04-24; analytics is PostHog's job.
                posthog.capture(ANALYTICS_EVENTS.LOGIN, { isPwa, deviceType })
                dispatch(userActions.setUser(payload))
            }
            return payload
        }

        // 5xx = backend error, throw so tanstack retries
        if (userResponse.status >= 500) {
            console.error('Backend error fetching user:', userResponse.status)
            throw new BackendError('Backend error fetching user', userResponse.status)
        }

        // 401 (expired/invalid JWT) and 404 (user no longer exists — e.g. local
        // DB re-seeded out from under a stale cookie) both mean the JWT is
        // irrecoverable. Wipe the token so the next render escapes to /setup
        // instead of looping on the same dead JWT.
        if (userResponse.status === 401 || userResponse.status === 404) {
            clearAuthToken()
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
