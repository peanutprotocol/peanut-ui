// unified api fetch. talks directly to PEANUT_API_URL on every platform.
//
// History: this file used to branch web → Next.js proxy vs. capacitor →
// direct backend. The proxy existed because old backend routes gated on
// a server-side `Api-Key` header that couldn't ship to the browser.
// peanut-api-ts dropped that requirement (commit eb616b8c, 2026-04-09):
// every user-facing route now authenticates via the JWT Bearer header
// alone, and the API's CORS config already allows *.peanut.me +
// vercel previews + capacitor://. So the proxy hop was pure overhead +
// a class of timeout/abort bugs (Sentry PEANUT-UI-F8V: 956 events).
// Web and native now follow the same path.

import { getAuthHeaders } from './auth-token'
import { fetchWithSentry } from './sentry.utils'
import { PEANUT_API_URL } from '@/constants/general.consts'

/**
 * Make a backend call. Auth header is attached if the user has a token.
 */
export function apiFetch(path: string, options?: RequestInit): Promise<Response> {
    const extraHeaders = (options?.headers as Record<string, string>) ?? {}
    const headers: Record<string, string> = {}

    // default to json content-type when there's a body, but respect caller-provided type
    if (options?.body && !extraHeaders['Content-Type']) {
        headers['Content-Type'] = 'application/json'
    }

    Object.assign(headers, getAuthHeaders(extraHeaders))

    return fetchWithSentry(`${PEANUT_API_URL}${path}`, { ...options, headers })
}

/**
 * Variant that accepts `timeoutMs`. Kept as a separate symbol because most
 * call sites import this one specifically.
 */
export function serverFetch(path: string, options?: RequestInit & { timeoutMs?: number }): Promise<Response> {
    const { timeoutMs, ...fetchOptions } = options ?? {}
    const callerHeaders = (fetchOptions.headers as Record<string, string>) ?? {}
    const headers: Record<string, string> = {}

    // default json content-type for body-bearing requests (case-insensitive check)
    const hasContentType = Object.keys(callerHeaders).some((k) => k.toLowerCase() === 'content-type')
    if (fetchOptions.body && !hasContentType) {
        headers['Content-Type'] = 'application/json'
    }

    Object.assign(headers, getAuthHeaders(callerHeaders))

    const args: Parameters<typeof fetchWithSentry> = [`${PEANUT_API_URL}${path}`, { ...fetchOptions, headers }]
    if (timeoutMs !== undefined) args[2] = timeoutMs
    return fetchWithSentry(...args)
}
