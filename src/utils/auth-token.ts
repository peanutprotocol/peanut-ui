// client-side jwt token management.
// web: the token lives in a readable cookie; we mirror it into the
//      Authorization header (existing behavior, 40+ call sites).
// capacitor: JS never holds the token. The server's Set-Cookie lands in
//      CapacitorHttp's NATIVE cookie jar, which attaches it to every
//      api.peanut.me request — durable across the passkey (Face ID) prompt
//      and webview storage eviction, which made localStorage-based header
//      auth fail (PEANUT-UI-QTQ). getAuthToken is therefore null on native
//      by design; auth state checks belong on the user query or the jar
//      (see hasNativeSessionCookie).

import Cookies from 'js-cookie'
import { isCapacitor } from './capacitor'
import { PEANUT_API_URL } from '@/constants/general.consts'

const JWT_COOKIE_KEY = 'jwt-token'
const JWT_STORAGE_KEY = 'jwt-token'

/**
 * reads the jwt token for Authorization-header auth.
 * web: from cookie via js-cookie. capacitor: always null — the native cookie
 * jar authenticates requests; JS is not a token custodian.
 */
export function getAuthToken(): string | null {
    if (isCapacitor()) return null
    return Cookies.get(JWT_COOKIE_KEY) ?? null
}

/**
 * stores the jwt token (web only). On capacitor this is a no-op: the server's
 * Set-Cookie already updated the native jar, which is the source of truth.
 */
export function setAuthToken(token: string): void {
    if (isCapacitor()) return
    Cookies.set(JWT_COOKIE_KEY, token, { expires: 30, path: '/' })
}

/**
 * capacitor-only: does the native cookie jar hold a session cookie for the
 * API? Async because the jar lives on the native side. Used for cheap
 * routing hints (e.g. cold-start home-vs-setup) — the /users/me query
 * remains the authority on whether the session is actually valid.
 */
export async function hasNativeSessionCookie(): Promise<boolean> {
    if (!isCapacitor()) return false
    try {
        const { CapacitorCookies } = await import('@capacitor/core')
        const cookies = await CapacitorCookies.getCookies({ url: PEANUT_API_URL })
        return !!cookies?.[JWT_COOKIE_KEY]
    } catch {
        return false
    }
}

/**
 * clears the session.
 * capacitor: clears the native cookie jar (the actual credential) plus any
 * localStorage remnant from older builds.
 * web: removes the cookie.
 * returns a promise for the native jar clear so logout can await it before
 * reloading; other callers may safely ignore it.
 */
export function clearAuthToken(): Promise<void> {
    let nativeClear: Promise<void> = Promise.resolve()
    if (isCapacitor()) {
        localStorage.removeItem(JWT_STORAGE_KEY)
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
 * web: includes Authorization bearer token. capacitor: no Authorization —
 * the native cookie jar authenticates the request.
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
