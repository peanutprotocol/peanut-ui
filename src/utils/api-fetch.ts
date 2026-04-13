// unified api fetch that handles capacitor vs web branching in one place.

import { isCapacitor } from './capacitor'
import { getAuthHeaders } from './auth-token'
import { fetchWithSentry } from './sentry.utils'
import { PEANUT_API_URL } from '@/constants/general.consts'

/**
 * makes an api call that works in both web (via next.js proxy) and capacitor (direct backend).
 */
export function apiFetch(backendPath: string, proxyPath: string, options?: RequestInit): Promise<Response> {
    const url = isCapacitor() ? `${PEANUT_API_URL}${backendPath}` : proxyPath
    const extraHeaders = (options?.headers as Record<string, string>) ?? {}

    const headers: Record<string, string> = {}

    // only set content-type when there's a body
    if (options?.body) {
        headers['Content-Type'] = 'application/json'
    }

    if (isCapacitor()) {
        Object.assign(headers, getAuthHeaders(extraHeaders))
    } else {
        Object.assign(headers, extraHeaders)
    }

    return fetchWithSentry(url, { ...options, headers })
}
