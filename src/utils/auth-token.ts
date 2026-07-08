// client-side jwt token management for both web and capacitor native app
// web: reads/writes from cookies (existing behavior)
// capacitor: reads/writes from localStorage (cookies don't work reliably in webview)

import Cookies from 'js-cookie'
import { isCapacitor } from './capacitor'
import { PEANUT_API_URL } from '@/constants/general.consts'

const JWT_COOKIE_KEY = 'jwt-token'
const JWT_STORAGE_KEY = 'jwt-token'

/**
 * reads the jwt token.
 * capacitor: from localStorage, with cookie fallback for migration
 * web: from cookie via js-cookie (existing 40+ call sites use this)
 */
export function getAuthToken(): string | null {
    if (isCapacitor()) {
        const stored = localStorage.getItem(JWT_STORAGE_KEY)
        if (stored) return stored

        // migration: token may be in cookie from previous code version
        const fromCookie = Cookies.get(JWT_COOKIE_KEY)
        if (fromCookie) {
            localStorage.setItem(JWT_STORAGE_KEY, fromCookie)
            return fromCookie
        }
        return null
    }
    return Cookies.get(JWT_COOKIE_KEY) ?? null
}

/**
 * stores the jwt token.
 * capacitor: in localStorage
 * web: in cookie (for backward compat with existing code)
 */
export function setAuthToken(token: string): void {
    if (isCapacitor()) {
        localStorage.setItem(JWT_STORAGE_KEY, token)
    } else {
        Cookies.set(JWT_COOKIE_KEY, token, { expires: 30, path: '/' })
    }
}

/**
 * clears the jwt token.
 * capacitor: removes from localStorage and the native cookie jar
 * web: removes cookie
 * returns a promise for the native cookie-jar clear so logout can await it
 * before reloading; other callers may safely ignore it.
 */
export function clearAuthToken(): Promise<void> {
    let nativeClear: Promise<void> = Promise.resolve()
    if (isCapacitor()) {
        localStorage.removeItem(JWT_STORAGE_KEY)
        // The verify endpoints' Set-Cookie lands a jwt-token cookie in
        // CapacitorHttp's native cookie jar, which document.cookie can't touch —
        // clear it so no stale credential lingers after logout / account switch.
        nativeClear = import('@capacitor/core')
            .then(({ CapacitorCookies }) => CapacitorCookies.clearCookies({ url: PEANUT_API_URL }))
            .catch(() => {})
    }
    // always clear cookie too in case it was set by backend Set-Cookie header
    Cookies.remove(JWT_COOKIE_KEY, { path: '/' })
    document.cookie = 'jwt-token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;'
    return nativeClear
}

/**
 * builds headers for authenticated api calls.
 * includes Authorization bearer token.
 */
export function getAuthHeaders(extraHeaders?: Record<string, string>): Record<string, string> {
    const headers: Record<string, string> = {}

    const token = getAuthToken()
    if (token) {
        headers['Authorization'] = `Bearer ${token}`
    }

    if (extraHeaders) {
        Object.assign(headers, extraHeaders)
    }

    return headers
}
