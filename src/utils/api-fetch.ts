// unified api fetch that handles capacitor vs web branching in one place.

import { isCapacitor } from './capacitor'
import { getAuthHeaders } from './auth-token'
import { fetchWithSentry } from './sentry.utils'
import { PEANUT_API_URL } from '@/constants/general.consts'

/**
 * makes an api call that works in both web (via next.js proxy) and capacitor (direct backend).
 * caller provides both backend and proxy paths explicitly.
 */
export function apiFetch(backendPath: string, proxyPath: string, options?: RequestInit): Promise<Response> {
    const url = isCapacitor() ? `${PEANUT_API_URL}${backendPath}` : proxyPath
    const extraHeaders = (options?.headers as Record<string, string>) ?? {}

    const headers: Record<string, string> = {}

    // default to json content-type when there's a body, but respect caller-provided type
    if (options?.body && !extraHeaders['Content-Type']) {
        headers['Content-Type'] = 'application/json'
    }

    if (isCapacitor()) {
        Object.assign(headers, getAuthHeaders(extraHeaders))
    } else {
        Object.assign(headers, extraHeaders)
    }

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
export function serverFetch(path: string, options?: RequestInit): Promise<Response> {
    const method = (options?.method ?? 'GET').toUpperCase()
    const callerHeaders = (options?.headers as Record<string, string>) ?? {}
    const headers: Record<string, string> = {}

    // default json content-type for body-bearing requests
    if (options?.body && !callerHeaders['Content-Type']) {
        headers['Content-Type'] = 'application/json'
    }

    if (isCapacitor()) {
        // native: direct backend call with auth
        Object.assign(headers, getAuthHeaders(callerHeaders))
        return fetchWithSentry(`${PEANUT_API_URL}${path}`, { ...options, headers })
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

    return fetchWithSentry(`${proxyPrefix}${path}`, { ...options, headers })
}
