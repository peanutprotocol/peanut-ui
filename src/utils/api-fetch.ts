// Calls PEANUT_API_URL directly on every platform. The web→/api/proxy hop
// was retired once peanut-api-ts dropped its api-key requirement (eb616b8c)
// and CORS already allowed *.peanut.me + capacitor:// + vercel previews.

import { getAuthHeaders, authReady } from './auth-token'
import { fetchWithSentry } from './sentry.utils'
import { PEANUT_API_URL } from '@/constants/general.consts'
import { isDemoMode } from './demo'

type FetchOptions = RequestInit & { timeoutMs?: number }

async function callApi(path: string, options?: FetchOptions): Promise<Response> {
    // Native-only demo mode: route to synthetic data before any header/network
    // work. isDemoMode() is false on web, so this is unreachable for real users.
    // Lazy import keeps the demo module (and its viem-using fixtures) out of the
    // web bundle and out of every api-fetch importer's module graph.
    if (isDemoMode()) return import('./demo-api').then((m) => m.demoRespond(path, options))

    // Native: token hydrates async from Preferences; gate here so a cold-start
    // request can't go out unauthenticated. Instant on web.
    await authReady()

    const { timeoutMs, ...fetchOptions } = options ?? {}
    const callerHeaders = (fetchOptions.headers as Record<string, string>) ?? {}

    const headers: Record<string, string> = {}
    const hasContentType = Object.keys(callerHeaders).some((k) => k.toLowerCase() === 'content-type')
    if (fetchOptions.body && !hasContentType) {
        headers['Content-Type'] = 'application/json'
    }
    Object.assign(headers, getAuthHeaders(callerHeaders))

    const args: Parameters<typeof fetchWithSentry> = [`${PEANUT_API_URL}${path}`, { ...fetchOptions, headers }]
    if (timeoutMs !== undefined) args[2] = timeoutMs
    return fetchWithSentry(...args)
}

export const apiFetch = callApi
export const serverFetch = callApi
