// unified api fetch that handles capacitor vs web branching in one place.
// replaces the isCapacitor() ? directUrl : proxyUrl pattern that was repeated 8+ times.

import { isCapacitor } from './capacitor'
import { getAuthHeaders } from './auth-token'
import { fetchWithSentry } from './sentry.utils'
import { PEANUT_API_URL } from '@/constants/general.consts'

/**
 * makes an api call that works in both web (via next.js proxy) and capacitor (direct backend).
 *
 * @param backendPath - the backend endpoint path (e.g. '/get-user', '/bridge/onramp/create')
 * @param proxyPath - the next.js proxy path (e.g. '/api/peanut/user/get-user-from-cookie')
 * @param options - fetch options (method, body, extra headers)
 */
export function apiFetch(backendPath: string, proxyPath: string, options?: RequestInit): Promise<Response> {
    const url = isCapacitor() ? `${PEANUT_API_URL}${backendPath}` : proxyPath
    const defaultHeaders = isCapacitor()
        ? getAuthHeaders(options?.headers as Record<string, string>)
        : { 'Content-Type': 'application/json', ...(options?.headers as Record<string, string>) }

    return fetchWithSentry(url, { ...options, headers: defaultHeaders })
}
