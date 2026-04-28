// unified api fetch that handles capacitor vs web branching in one place.

import { isCapacitor } from './capacitor'
import { getAuthHeaders } from './auth-token'
import { fetchWithSentry } from './sentry.utils'
import { PEANUT_API_URL } from '@/constants/general.consts'

/**
 * makes an api call that works in both web (via next.js proxy) and capacitor (direct backend).
 *
 * Auth: always adds `Authorization: Bearer ${jwt}` when a token is present,
 * regardless of web/capacitor. Backend routes that gate on `verifyAuth`
 * read the Authorization header, not the cookie — the proxy forwards any
 * headers the caller sets (see `api/proxy/[...slug]/route.ts`). Previously
 * only capacitor mode set the header; web calls like `/bridge/onramp/create`
 * 400'd with "headers must have required property 'authorization'" because
 * the cookie never became a header. Single source, both modes.
 *
 * Prefer `serverFetch` (below) for new call sites — it owns proxy routing by
 * method so callers don't have to pass separate backend/proxy paths.
 */
export function apiFetch(backendPath: string, proxyPath: string, options?: RequestInit): Promise<Response> {
    const url = isCapacitor() ? `${PEANUT_API_URL}${backendPath}` : proxyPath
    const extraHeaders = (options?.headers as Record<string, string>) ?? {}

    const headers: Record<string, string> = {}

    // default to json content-type when there's a body, but respect caller-provided type
    if (options?.body && !extraHeaders['Content-Type']) {
        headers['Content-Type'] = 'application/json'
    }

    Object.assign(headers, getAuthHeaders(extraHeaders))

    return fetchWithSentry(url, { ...options, headers })
}

/**
 * replaces direct PEANUT_API_URL calls in former server action files.
 * web: routes through next.js proxy (bypasses CORS, injects api-key server-side).
 * native: calls backend directly with auth token from localStorage.
 *
 * proxy routing by method:
 *   GET/HEAD  -> /api/proxy/get/...
 *   PATCH     -> /api/proxy/patch/...
 *   DELETE    -> /api/proxy/delete/...
 *   POST/etc  -> /api/proxy/...
 */
export function serverFetch(path: string, options?: RequestInit & { timeoutMs?: number }): Promise<Response> {
    const { timeoutMs, ...fetchOptions } = options ?? {}
    const method = (fetchOptions.method ?? 'GET').toUpperCase()
    const callerHeaders = (fetchOptions.headers as Record<string, string>) ?? {}
    const headers: Record<string, string> = {}

    // default json content-type for body-bearing requests (case-insensitive check)
    const hasContentType = Object.keys(callerHeaders).some((k) => k.toLowerCase() === 'content-type')
    if (fetchOptions.body && !hasContentType) {
        headers['Content-Type'] = 'application/json'
    }

    if (isCapacitor()) {
        // native: direct backend call with auth
        Object.assign(headers, getAuthHeaders(callerHeaders))
        const args: Parameters<typeof fetchWithSentry> = [`${PEANUT_API_URL}${path}`, { ...fetchOptions, headers }]
        if (timeoutMs !== undefined) args[2] = timeoutMs
        return fetchWithSentry(...args)
    }

    // web: route through proxy — forward auth header so proxy can relay it
    const authHeaders = getAuthHeaders()
    Object.assign(headers, authHeaders, callerHeaders)

    let proxyPrefix: string
    switch (method) {
        case 'GET':
        case 'HEAD':
            proxyPrefix = '/api/proxy/get'
            break
        case 'PATCH':
            proxyPrefix = '/api/proxy/patch'
            break
        case 'DELETE':
            proxyPrefix = '/api/proxy/delete'
            break
        default:
            proxyPrefix = '/api/proxy'
            break
    }

    const args: Parameters<typeof fetchWithSentry> = [`${proxyPrefix}${path}`, { ...fetchOptions, headers }]
    if (timeoutMs !== undefined) args[2] = timeoutMs
    return fetchWithSentry(...args)
}
