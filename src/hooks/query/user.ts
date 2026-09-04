import { type IUserProfile } from '@/interfaces/interfaces'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { useQuery } from '@tanstack/react-query'
import { isStandaloneDisplayMode } from '../usePWAStatus'
import { useDeviceType } from '../useGetDeviceType'
import { USER } from '@/constants/query.consts'
import { apiFetch } from '@/utils/api-fetch'
import { clearAuthToken, getAuthToken, getClearEpoch, setAuthToken } from '@/utils/auth-token'
import { isDemoMode } from '@/utils/demo'
import { isNativeBridge } from '@/utils/capacitor'
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
    const { deviceType } = useDeviceType()

    const fetchUser = async (): Promise<IUserProfile | null> => {
        // Demo mode: no backend/JWT/passkey — return the synthetic user.
        if (isDemoMode()) {
            return DEMO_USER
        }

        const epochAtRequest = getClearEpoch()
        const tokenAtRequest = getAuthToken()
        const userResponse = await apiFetch('/users/me', { method: 'GET' })
        if (userResponse.ok) {
            const payload: (IUserProfile & { token?: string }) | null = await userResponse.json()

            // Sliding refresh: backend re-mints when the JWT crosses half its
            // lifetime and ships the new one alongside the user payload. Swap
            // it in client-side so active users never hit the 30d hard logout.
            // Strip `token` unconditionally so auth state never leaks into the
            // user store, even if the backend ever sends a falsy value.
            // epoch guard: if logout cleared the session while this request
            // was in flight, re-persisting the refreshed token would resurrect
            // it (Android stuck-splash loop) — drop it instead.
            if (payload && 'token' in payload) {
                if (payload.token && getClearEpoch() === epochAtRequest) setAuthToken(payload.token)
                delete payload.token
            }

            if (payload) {
                // Was: hitUserMetric(userData.user.userId, 'login', ...) → POST /users/:id/metrics/login.
                // DB `user_metrics` table deprecated 2026-04-24; analytics is PostHog's job.
                // For analytics the native app is not a PWA, and a capacitor-
                // flavored WEB build in a plain browser tab isn't either — use
                // real display-mode detection, not usePWAStatus's Capacitor
                // short-circuit (TASK-21782 telemetry fix).
                posthog.capture(ANALYTICS_EVENTS.LOGIN, {
                    isPwa: isNativeBridge() ? false : isStandaloneDisplayMode(),
                    deviceType,
                })
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
        // await: the native Preferences.remove must be dispatched before the
        // redirect-to-/setup teardown, or the dead JWT survives into the next
        // cold start and re-enters the home→401→setup loop.
        if (userResponse.status === 401 || userResponse.status === 404) {
            // A login that completed while this request was in flight stored a
            // fresh token (passkey sheet blur → refetchOnWindowFocus race). A
            // stale 401 for the OLD token must not wipe it or null the user —
            // throw so tanstack retries with the new token instead.
            if (getAuthToken() !== tokenAtRequest) {
                throw new Error('auth token rotated mid-request')
            }
            await clearAuthToken()
        }

        // 4xx = auth failure — resolve null so the layout redirects to /setup
        console.warn('Failed to fetch user, status:', userResponse.status)
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
        // Demo mode: seed the synthetic user synchronously so `user` is never
        // null on first render — prevents the protected-route layout racing a
        // /setup redirect before the query settles. (Was the redux user
        // slice's initialState seed — TASK-21462.)
        placeholderData: isDemoMode() ? DEMO_USER : undefined,
    })
}
