// Calls PEANUT_API_URL directly on every platform. The web→/api/proxy hop
// was retired once peanut-api-ts dropped its api-key requirement (eb616b8c)
// and CORS already allowed *.peanut.me + capacitor:// + vercel previews.

import { getAuthHeaders, getAuthToken, authReady } from './auth-token'
import { fetchWithSentry } from './sentry.utils'
import { PEANUT_API_URL } from '@/constants/general.consts'
import { isCapacitor } from './capacitor'
import { isDemoMode } from './demo'
import { DEV_TOOLS_ENABLED } from '@/constants/dev-tools.consts'
import { ensureActiveFixture } from '@/dev/fixtures/active'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import {
    API_SLOW_THRESHOLD_MS,
    apiRouteTemplate,
    parseServerTiming,
    shouldSampleApiRequest,
} from './performance-analytics'

type FetchOptions = RequestInit & {
    timeoutMs?: number
    /** Public endpoints can opt out of sending the web bearer token. */
    includeAuth?: boolean
    /** See `FetchWithSentryOptions.silentTimeout`. Rides through on the spread. */
    silentTimeout?: boolean
    /** Hide sensitive URL, request, response and error data in fetch telemetry. */
    redactTelemetry?: boolean
}

async function callApi(path: string, options?: FetchOptions): Promise<Response> {
    // Native-only demo mode: route to synthetic data before any header/network
    // work. isDemoMode() is false on web, so this is unreachable for real users.
    // Lazy import keeps the demo module (and its viem-using fixtures) out of the
    // web bundle and out of every api-fetch importer's module graph.
    if (isDemoMode()) return import('./demo-api').then((m) => m.demoRespond(path, options))

    // Dev fixtures: `?__fixture=<name>` answers every call from a named app
    // state, so any screen renders with no DB, no API and no provider keys.
    // Hooked HERE because callApi is the one layer every API call in the app
    // goes through — no per-call-site branching anywhere. DEV_TOOLS_ENABLED is
    // inlined at build time, so production folds this branch away and the
    // bundler drops the chunk.
    if (DEV_TOOLS_ENABLED && ensureActiveFixture()) {
        return import('@/dev/fixtures/respond').then((m) => m.fixtureRespond(path, options))
    }

    const { timeoutMs, includeAuth = true, ...fetchOptions } = options ?? {}
    const startedAt = globalThis.performance?.now?.() ?? Date.now()
    let authWaitMs = 0

    // Native: token hydrates async from Preferences; gate here so a cold-start
    // request can't go out unauthenticated. Instant on web. An explicitly
    // unauthenticated read skips it — a public rate must not queue behind auth
    // hydration, and it would send no token either way.
    if (includeAuth) {
        await authReady()
        authWaitMs = (globalThis.performance?.now?.() ?? Date.now()) - startedAt
    }

    const callerHeaders = (fetchOptions.headers as Record<string, string>) ?? {}

    const headers: Record<string, string> = {}
    const hasContentType = Object.keys(callerHeaders).some((k) => k.toLowerCase() === 'content-type')
    // FormData must keep its fetch-generated multipart boundary — forcing
    // application/json here would break attachment uploads (send-links, charges).
    if (fetchOptions.body && !hasContentType && !(fetchOptions.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json'
    }
    Object.assign(headers, includeAuth ? getAuthHeaders(callerHeaders) : callerHeaders)

    /*
     * No JS-readable token on native means either logged out or a legacy
     * cookie-jar session whose JWT lives only in the OS-level cookie store —
     * unreadable from JS on Android (CapacitorCookies.getCookies ignores its
     * url param there), so the two are indistinguishable here. Prefer the OS
     * HTTP client for both: it attaches that cookie where the WebView sends
     * nothing, and the /users/me sliding refresh then migrates the session to
     * Preferences + header auth.
     */
    const preferNativeTransport = isCapacitor() && !getAuthToken()

    const args: Parameters<typeof fetchWithSentry> = [
        `${PEANUT_API_URL}${path}`,
        { ...fetchOptions, headers, ...(preferNativeTransport && { preferNativeTransport }) },
    ]
    if (timeoutMs !== undefined) args[2] = timeoutMs

    const method = (fetchOptions.method ?? 'GET').toUpperCase()
    const route = apiRouteTemplate(path)

    try {
        const response = await fetchWithSentry(...args)
        captureApiTiming({
            route,
            method,
            startedAt,
            authWaitMs,
            response,
        })
        return response
    } catch (error) {
        // a request its caller cancelled is not a timeout or a network error
        if (fetchOptions.signal?.aborted) throw error
        captureApiTiming({
            route,
            method,
            startedAt,
            authWaitMs,
            error,
        })
        throw error
    }
}

interface ApiTimingInput {
    route: string
    method: string
    startedAt: number
    authWaitMs: number
    response?: Response
    error?: unknown
}

function captureApiTiming({ route, method, startedAt, authWaitMs, response, error }: ApiTimingInput): void {
    // serverFetch shares this wrapper but can run in server components/actions;
    // only the browser PostHog client should emit client-performance events.
    if (typeof window === 'undefined') return

    const finishedAt = globalThis.performance?.now?.() ?? Date.now()
    const durationMs = Math.max(0, finishedAt - startedAt)
    const statusCode = typeof response?.status === 'number' ? response.status : undefined
    // fetchWithSentry converts its internal AbortError to this stable public
    // error name. Keep AbortError too for alternate/native transports.
    const errorName = error instanceof Error ? error.name : undefined
    const timedOut = errorName === 'ConnectionTimeoutError' || errorName === 'AbortError'
    const outcome = error ? (timedOut ? 'timeout' : 'network_error') : response?.ok ? 'success' : 'http_error'
    const serverDurationMs = parseServerTiming(response?.headers?.get?.('server-timing') ?? null)
    const properties = {
        route,
        method,
        duration_ms: Math.round(durationMs),
        auth_wait_ms: Math.round(authWaitMs),
        ...(serverDurationMs === undefined
            ? {}
            : {
                  server_duration_ms: serverDurationMs,
                  client_network_overhead_ms: Math.max(0, Math.round(durationMs - authWaitMs - serverDurationMs)),
              }),
        ...(statusCode === undefined
            ? {}
            : {
                  status_code: statusCode,
                  status_class: `${Math.floor(statusCode / 100)}xx`,
              }),
        outcome,
    }

    if (shouldSampleApiRequest()) {
        posthog.capture(ANALYTICS_EVENTS.API_REQUEST_COMPLETED, { ...properties, sample_rate: 0.1 })
    }

    if (error || (statusCode !== undefined && statusCode >= 500) || durationMs >= API_SLOW_THRESHOLD_MS) {
        posthog.capture(ANALYTICS_EVENTS.API_REQUEST_PROBLEM, {
            ...properties,
            problem:
                error != null
                    ? timedOut
                        ? 'timeout'
                        : 'network_error'
                    : statusCode !== undefined && statusCode >= 500
                      ? 'server_error'
                      : 'slow',
        })
    }
}

export const apiFetch = callApi
export const serverFetch = callApi
