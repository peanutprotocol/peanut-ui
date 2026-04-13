// client-side jwt token management for both web and capacitor native app
// web: reads/writes from cookies (existing behavior)
// capacitor: reads/writes from localStorage (cookies don't work reliably in webview)

import Cookies from 'js-cookie'
import { isCapacitor } from './capacitor'

const JWT_COOKIE_KEY = 'jwt-token'
const JWT_STORAGE_KEY = 'jwt-token'

/**
 * reads the jwt token.
 * capacitor: from localStorage (reliable, no native CookieManager issues)
 * web: from cookie via js-cookie (existing 40+ call sites use this)
 */
export function getAuthToken(): string | null {
    if (isCapacitor()) {
        return localStorage.getItem(JWT_STORAGE_KEY)
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
 * capacitor: removes from localStorage (reliable, no domain/path issues)
 * web: removes cookie
 */
export function clearAuthToken(): void {
    if (isCapacitor()) {
        localStorage.removeItem(JWT_STORAGE_KEY)
    }
    // always clear cookie too in case it was set by backend Set-Cookie header
    Cookies.remove(JWT_COOKIE_KEY, { path: '/' })
    document.cookie = 'jwt-token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;'
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
