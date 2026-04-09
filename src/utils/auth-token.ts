// client-side jwt token management for both web and capacitor native app

import Cookies from 'js-cookie'

const JWT_COOKIE_KEY = 'jwt-token'

/**
 * reads the jwt token from client-side cookie storage.
 * uses js-cookie (same library used by 40+ existing call sites in the codebase).
 */
export function getAuthToken(): string | null {
    return Cookies.get(JWT_COOKIE_KEY) ?? null
}

/**
 * builds headers for authenticated api calls.
 * includes Authorization bearer token and content-type.
 */
export function getAuthHeaders(extraHeaders?: Record<string, string>): Record<string, string> {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    }

    const token = getAuthToken()
    if (token) {
        headers['Authorization'] = `Bearer ${token}`
    }

    if (extraHeaders) {
        Object.assign(headers, extraHeaders)
    }

    return headers
}
