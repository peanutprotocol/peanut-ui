// client-side jwt token management.
// web: the token lives in a readable cookie; we mirror it into the
//      Authorization header (existing behavior, 40+ call sites).
// capacitor: the token lives in native Preferences (SharedPreferences /
//      UserDefaults), hydrated into an in-memory cache at startup and sent
//      as an Authorization header — same as web. Native storage survives
//      webview data eviction, which is what broke localStorage-based header
//      auth (PEANUT-UI-QTQ). The CapacitorHttp cookie jar is no longer the
//      credential store (its Android GET proxy stalls, PEANUT-UI-R44), but
//      older cookie-auth binaries keep working: the server still accepts the
//      jwt-token cookie, and hasNativeSession falls back to the jar.

import Cookies from 'js-cookie'
import { isCapacitor } from './capacitor'
import { PEANUT_API_URL } from '@/constants/general.consts'

const JWT_COOKIE_KEY = 'jwt-token'
const JWT_STORAGE_KEY = 'jwt-token'

let nativeToken: string | null = null
let hydration: Promise<void> | null = null

async function hydrateFromPreferences(): Promise<void> {
    try {
        const { Preferences } = await import('@capacitor/preferences')
        const { value } = await Preferences.get({ key: JWT_STORAGE_KEY })
        // a login that raced hydration is fresher than the stored value
        if (value && nativeToken === null) nativeToken = value
    } catch {
        // plugin missing (older binary running OTA'd JS) — those builds still
        // authenticate via the CapacitorHttp cookie jar, so this is benign.
    }
}

/**
 * resolves once the native token cache is hydrated from Preferences.
 * Instant on web. Await this before building auth headers on native so a
 * cold start can't race the async Preferences read.
 */
export function authReady(): Promise<void> {
    if (!isCapacitor()) return Promise.resolve()
    if (!hydration) hydration = hydrateFromPreferences()
    return hydration
}

/**
 * reads the jwt token for Authorization-header auth.
 * web: from cookie via js-cookie. capacitor: from the in-memory cache
 * (callers that can run at cold start must await authReady() first).
 */
export function getAuthToken(): string | null {
    if (isCapacitor()) return nativeToken
    return Cookies.get(JWT_COOKIE_KEY) ?? null
}

/**
 * stores the jwt token. web: readable cookie. capacitor: in-memory cache +
 * native Preferences (fire-and-forget; the cache is authoritative for this
 * session). Fed by the login-verify capture and the /users/me sliding
 * refresh.
 */
export function setAuthToken(token: string): void {
    if (isCapacitor()) {
        nativeToken = token
        import('@capacitor/preferences')
            .then(({ Preferences }) => Preferences.set({ key: JWT_STORAGE_KEY, value: token }))
            .catch(() => {})
        return
    }
    Cookies.set(JWT_COOKIE_KEY, token, { expires: 30, path: '/' })
}

/**
 * capacitor-only: is there a stored session? Awaits hydration, then falls
 * back to the legacy CapacitorHttp cookie jar so sessions created by older
 * cookie-auth binaries still route to home. Used for cheap routing hints
 * (e.g. cold-start home-vs-setup) — the /users/me query remains the
 * authority on whether the session is actually valid.
 */
export async function hasNativeSession(): Promise<boolean> {
    if (!isCapacitor()) return false
    await authReady()
    if (nativeToken) return true
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
 * capacitor: clears the in-memory cache, native Preferences, the legacy
 * cookie jar, and any localStorage remnant from older builds.
 * web: removes the cookie.
 * returns a promise for the native clears so logout can await it before
 * reloading; other callers may safely ignore it.
 */
export function clearAuthToken(): Promise<void> {
    let nativeClear: Promise<void> = Promise.resolve()
    if (isCapacitor()) {
        nativeToken = null
        localStorage.removeItem(JWT_STORAGE_KEY)
        const prefsClear = import('@capacitor/preferences')
            .then(({ Preferences }) => Preferences.remove({ key: JWT_STORAGE_KEY }))
            .catch(() => {})
        const jarClear = import('@capacitor/core')
            .then(({ CapacitorCookies }) => CapacitorCookies.clearCookies({ url: PEANUT_API_URL }))
            .catch(() => {})
        nativeClear = Promise.all([prefsClear, jarClear]).then(() => undefined)
    }
    // always clear cookie too in case it was set by backend Set-Cookie header
    Cookies.remove(JWT_COOKIE_KEY, { path: '/' })
    document.cookie = 'jwt-token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;'
    return nativeClear
}

/**
 * builds headers for authenticated api calls: Authorization bearer token on
 * both web and capacitor when a token is available.
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
