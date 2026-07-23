// client-side jwt token management.
// web: the token lives in a readable cookie; we mirror it into the
//      Authorization header (existing behavior, 40+ call sites).
// capacitor: three session modes, detected once per launch:
//   'guarded' — the token sits in biometric-guarded Keychain/Keystore
//      (issue #2472). JS only materializes it after a successful biometric
//      assertion (unlockGuardedToken); suspendAuthSession drops it again when
//      the app lock engages. authReady() parks every API caller while locked,
//      so a locked app never emits an unauthenticated request.
//   'plain' — legacy Preferences storage (older binaries without the plugin,
//      or devices without enrolled biometrics). Byte-for-byte the previous
//      behavior: hydrate at startup, WebAuthn deterrent gate only.
//   'none' — no stored session.
// Native storage survives webview data eviction, which is what broke
// localStorage-based header auth (PEANUT-UI-QTQ). The CapacitorHttp cookie jar
// is no longer the credential store (its Android GET proxy stalls,
// PEANUT-UI-R44), but older cookie-auth binaries keep working: the server
// still accepts the jwt-token cookie, and hasNativeSession falls back to the
// jar.

import Cookies from 'js-cookie'
import { isCapacitor } from './capacitor'
import { PEANUT_API_URL } from '@/constants/general.consts'
import { getLockState, setLockState } from './app-lock-state'
import {
    GuardedStoreError,
    canWriteSilently,
    guardedDelete,
    guardedRead,
    guardedWrite,
    isBiometryEnrolled,
    isGuardedStoreSupported,
} from './secure-token-store'

const JWT_COOKIE_KEY = 'jwt-token'
const JWT_STORAGE_KEY = 'jwt-token'
// Non-secret presence marker for the guarded token. Deleting it makes the app
// look signed out (login screen) — never an open session — because the JWT
// itself stays unreadable without a biometric. That is what makes the lock
// decision fail closed without having to prompt just to know a session exists.
const GUARDED_MARKER_KEY = 'guarded-token-present'

export type SessionMode = 'guarded' | 'plain' | 'none'
export type UnlockResult = 'unlocked' | 'cancelled' | 'session-gone' | 'downgraded'

let nativeToken: string | null = null
let hydration: Promise<void> | null = null
let sessionMode: Promise<SessionMode> | null = null
// bumped on every clearAuthToken; lets in-flight requests detect that the
// session was wiped underneath them (see useUserQuery's sliding refresh)
let clearEpoch = 0

// While the guarded session is locked, authReady() returns this gate's promise
// instead of resolving — API callers park here until unlock re-materializes
// the token (or a clear tears the session down).
let readyGate: { promise: Promise<void>; resolve: () => void } | null = null

function armReadyGate(): void {
    if (readyGate) return
    let resolve!: () => void
    const promise = new Promise<void>((r) => (resolve = r))
    readyGate = { promise, resolve }
}

function releaseReadyGate(): void {
    readyGate?.resolve()
    readyGate = null
}

async function getPreferences() {
    const { Preferences } = await import('@capacitor/preferences')
    return Preferences
}

async function detectSessionMode(): Promise<SessionMode> {
    if (isGuardedStoreSupported()) {
        try {
            const Preferences = await getPreferences()
            const marker = await Preferences.get({ key: GUARDED_MARKER_KEY })
            if (marker.value) return 'guarded'
        } catch {
            // can't tell whether a guarded session exists — stay locked rather
            // than fall open onto a weaker path
            return 'guarded'
        }
    }
    try {
        const Preferences = await getPreferences()
        const { value } = await Preferences.get({ key: JWT_STORAGE_KEY })
        if (value) return 'plain'
    } catch {}
    try {
        const { CapacitorCookies } = await import('@capacitor/core')
        const cookies = await CapacitorCookies.getCookies({ url: PEANUT_API_URL })
        if (cookies?.[JWT_COOKIE_KEY]) return 'plain'
    } catch {}
    return 'none'
}

/**
 * capacitor-only: which token-storage path is this launch on? Memoized —
 * login, migration, and clearAuthToken update it in place.
 */
export function getSessionMode(): Promise<SessionMode> {
    if (!isCapacitor()) return Promise.resolve('none')
    if (!sessionMode) sessionMode = detectSessionMode()
    return sessionMode
}

async function hydrateFromPreferences(): Promise<void> {
    try {
        const Preferences = await getPreferences()
        const { value } = await Preferences.get({ key: JWT_STORAGE_KEY })
        // a login that raced hydration is fresher than the stored value
        if (value && nativeToken === null) nativeToken = value
    } catch {
        // plugin missing (older binary running OTA'd JS) — those builds still
        // authenticate via the CapacitorHttp cookie jar, so this is benign.
    }
}

/**
 * resolves once a token can legitimately be read on native. Instant on web.
 * plain mode: after the Preferences hydration (previous behavior).
 * guarded mode: only while unlocked — while the app lock is engaged this
 * PARKS, so no caller can fire an unauthenticated request that would 401 and
 * tear the session down. Await this before building auth headers.
 */
export function authReady(): Promise<void> {
    if (!isCapacitor()) return Promise.resolve()
    return getSessionMode().then((mode) => {
        if (mode === 'guarded') {
            if (nativeToken !== null) return
            armReadyGate()
            return readyGate!.promise
        }
        if (!hydration) hydration = hydrateFromPreferences()
        return hydration
    })
}

/**
 * guarded mode: the unlock ceremony. guardedRead shows the OS biometric sheet
 * and only returns the token after a successful assertion — one prompt both
 * proves presence and releases the credential.
 *   'unlocked'     — token in memory, parked requests released.
 *   'cancelled'    — dismissed/failed/lockout; stay locked, retryable.
 *   'downgraded'   — guarded item gone but a plain token exists (interrupted
 *                    migration); caller should re-run the legacy flow.
 *   'session-gone' — guarded item gone (e.g. biometric re-enrollment
 *                    invalidated it) and no fallback: session cleared, route
 *                    to /setup as "session expired".
 */
export async function unlockGuardedToken(reason: string): Promise<UnlockResult> {
    try {
        const token = await guardedRead(reason)
        nativeToken = token
        setLockState('unlocked')
        releaseReadyGate()
        void finishGuardedMigration()
        return 'unlocked'
    } catch (error) {
        if (error instanceof GuardedStoreError && error.reason === 'not-found') {
            let plainToken: string | null = null
            try {
                const Preferences = await getPreferences()
                plainToken = (await Preferences.get({ key: JWT_STORAGE_KEY })).value ?? null
                await Preferences.remove({ key: GUARDED_MARKER_KEY })
            } catch {}
            await guardedDelete()
            sessionMode = null
            if (plainToken) return 'downgraded'
            await clearAuthToken()
            return 'session-gone'
        }
        return 'cancelled'
    }
}

/**
 * guarded mode: engage the lock. Drops the in-memory token and re-arms the
 * authReady gate so subsequent API callers park instead of going out
 * unauthenticated. A pause, not a logout: storage and clearEpoch untouched.
 * Call synchronously BEFORE rendering the lock screen on resume, so a
 * focus-triggered refetch can't race out with the old token.
 */
export function suspendAuthSession(): void {
    if (!isCapacitor()) return
    nativeToken = null
    hydration = null
    armReadyGate()
    setLockState('locked')
}

/**
 * plain-mode migration to guarded storage, called after the legacy WebAuthn
 * gate opens. Writes the guarded copy and the presence marker but KEEPS the
 * plain token: the next cold start's successful guarded read is the
 * round-trip proof, and only then does finishGuardedMigration delete the
 * plain copy. On Android this write shows a one-time BiometricPrompt (Keystore
 * writes need auth outside the validity window) — accepted migration cost.
 */
export async function migratePlainToGuarded(): Promise<void> {
    if (!isCapacitor() || !isGuardedStoreSupported()) return
    const mode = await getSessionMode()
    if (mode !== 'plain') return
    await authReady()
    const token = nativeToken
    if (!token) return
    if (!(await isBiometryEnrolled())) return
    try {
        await guardedWrite(token)
        const Preferences = await getPreferences()
        await Preferences.set({ key: GUARDED_MARKER_KEY, value: '1' })
        sessionMode = Promise.resolve('guarded')
    } catch {
        // stays plain; retried on the next launch
    }
}

// The plain copy (and the legacy cookie-jar remnant) is only deleted here —
// after a guarded read has proven the Keychain/Keystore copy is retrievable.
async function finishGuardedMigration(): Promise<void> {
    try {
        const Preferences = await getPreferences()
        await Preferences.remove({ key: JWT_STORAGE_KEY })
        localStorage.removeItem(JWT_STORAGE_KEY)
    } catch {}
    try {
        const { CapacitorCookies } = await import('@capacitor/core')
        await CapacitorCookies.clearCookies({ url: PEANUT_API_URL })
    } catch {}
}

/**
 * reads the jwt token for Authorization-header auth.
 * web: from cookie via js-cookie. capacitor: from the in-memory cache
 * (callers that can run at cold start must await authReady() first). Null
 * while the guarded session is locked — by design.
 */
export function getAuthToken(): string | null {
    if (isCapacitor()) return nativeToken
    return Cookies.get(JWT_COOKIE_KEY) ?? null
}

async function persistNativeToken(token: string): Promise<void> {
    const mode = await getSessionMode()
    if (mode === 'guarded') {
        // Outside the silent-write window (Android) the write would prompt —
        // skip it; the token stays memory-authoritative and the server
        // re-mints on a later /users/me anyway.
        if (!canWriteSilently()) return
        try {
            await guardedWrite(token)
        } catch {}
        return
    }
    // plain/none: sessions are born guarded whenever that is silently possible
    // (always on iOS; on Android only inside the post-auth window).
    if (isGuardedStoreSupported() && canWriteSilently() && (await isBiometryEnrolled())) {
        try {
            await guardedWrite(token)
            const Preferences = await getPreferences()
            await Preferences.set({ key: GUARDED_MARKER_KEY, value: '1' })
            sessionMode = Promise.resolve('guarded')
            // an existing plain copy is kept until the next unlock round-trip
            // proves the guarded one (finishGuardedMigration)
            return
        } catch {}
    }
    try {
        const Preferences = await getPreferences()
        await Preferences.set({ key: JWT_STORAGE_KEY, value: token })
    } catch {}
}

/**
 * stores the jwt token. web: readable cookie. capacitor: in-memory cache +
 * native storage (fire-and-forget; the cache is authoritative for this
 * session). Fed by the login-verify capture and the /users/me sliding
 * refresh. Dropped while the app lock is engaged: a refresh response landing
 * after suspension must not re-materialize the token behind the lock.
 */
export function setAuthToken(token: string): void {
    if (isCapacitor()) {
        if (getLockState() === 'locked') return
        nativeToken = token
        void persistNativeToken(token)
        return
    }
    Cookies.set(JWT_COOKIE_KEY, token, { expires: 30, path: '/' })
}

/**
 * capacitor-only: is there a stored session? Pure storage presence — never
 * prompts and never waits on the lock gate, so cold-start routing (e.g.
 * LandingPageCapacitorGate) can run while the app is still locked. Falls back
 * to the legacy CapacitorHttp cookie jar so sessions created by older
 * cookie-auth binaries still route to home. The /users/me query remains the
 * authority on whether the session is actually valid.
 */
export async function hasNativeSession(): Promise<boolean> {
    if (!isCapacitor()) return false
    if (nativeToken) return true
    try {
        const Preferences = await getPreferences()
        if (isGuardedStoreSupported() && (await Preferences.get({ key: GUARDED_MARKER_KEY })).value) return true
        if ((await Preferences.get({ key: JWT_STORAGE_KEY })).value) return true
    } catch {}
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
 * capacitor: clears the in-memory cache, the guarded Keychain/Keystore item
 * and its marker, native Preferences, the legacy cookie jar, and any
 * localStorage remnant from older builds. Releases any requests parked on the
 * lock gate (they proceed tokenless into the /setup teardown).
 * web: removes the cookie.
 * returns a promise for the native clears so logout can await it before
 * reloading; other callers may safely ignore it.
 */
export function clearAuthToken(): Promise<void> {
    clearEpoch++
    let nativeClear: Promise<void> = Promise.resolve()
    if (isCapacitor()) {
        nativeToken = null
        hydration = null
        sessionMode = null
        releaseReadyGate()
        setLockState('unlocked')
        localStorage.removeItem(JWT_STORAGE_KEY)
        const prefsClear = getPreferences()
            .then((Preferences) =>
                Promise.all([
                    Preferences.remove({ key: JWT_STORAGE_KEY }),
                    Preferences.remove({ key: GUARDED_MARKER_KEY }),
                ])
            )
            .catch(() => {})
        const jarClear = import('@capacitor/core')
            .then(({ CapacitorCookies }) => CapacitorCookies.clearCookies({ url: PEANUT_API_URL }))
            .catch(() => {})
        nativeClear = Promise.all([prefsClear, jarClear, guardedDelete()]).then(() => undefined)
    }
    // always clear cookie too in case it was set by backend Set-Cookie header
    Cookies.remove(JWT_COOKIE_KEY, { path: '/' })
    document.cookie = 'jwt-token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;'
    return nativeClear
}

/**
 * monotonic counter incremented by every clearAuthToken. Capture it before an
 * authenticated request and compare after: a changed value means the session
 * was cleared while the request was in flight, so any token the response
 * carries must not be re-persisted.
 */
export function getClearEpoch(): number {
    return clearEpoch
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
