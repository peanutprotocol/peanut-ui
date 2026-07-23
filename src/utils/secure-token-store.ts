// Biometric-guarded storage for the native session JWT (issue #2472).
//
// Wraps @capgo/capacitor-native-biometric so the rest of the app never touches
// the plugin directly — if the fork's gated path proves flaky on-device, only
// this file changes (a custom ~200-LOC Keychain/Keystore plugin is the planned
// fallback). The token is stored with AccessControl.BIOMETRY_CURRENT_SET:
// Keychain SecAccessControl on iOS, a BiometricPrompt-bound Keystore key on
// Android. The bytes are cryptographically unreadable without a successful
// biometric assertion — reading IS the unlock ceremony.

import { isAndroidNative, isCapacitor } from './capacitor'

const SERVER = 'me.peanut.jwt'
const USERNAME = 'jwt'

// AccessControl.BIOMETRY_CURRENT_SET — invalidated on biometric re-enrollment,
// which we surface as "session expired". Numeric to keep the plugin out of the
// web bundle (this module is imported by auth-token.ts on every platform).
const BIOMETRY_CURRENT_SET = 1

/*
 * Android Keystore keys with per-operation auth prompt on WRITES too, which
 * would put a BiometricPrompt behind every sliding-token refresh. A short
 * auth-validity window fixes that: the unlock read authorizes silent key use
 * for AUTH_VALIDITY_S, long enough to cover the re-minted token that
 * /users/me ships right after unlock. Writes outside the window are skipped
 * by the caller (canWriteSilently) — the token stays memory-only and the
 * server re-mints again later. iOS Keychain writes never prompt.
 */
const AUTH_VALIDITY_S = 60
const SILENT_WRITE_MARGIN_MS = 10_000

let lastAuthAt = 0

export type GuardedReadError = 'cancelled' | 'not-found' | 'transient'

export class GuardedStoreError extends Error {
    reason: GuardedReadError
    constructor(reason: GuardedReadError, message: string) {
        super(message)
        this.name = 'GuardedStoreError'
        this.reason = reason
    }
}

type PluginModule = typeof import('@capgo/capacitor-native-biometric')

function loadPlugin(): Promise<PluginModule> {
    return import('@capgo/capacitor-native-biometric')
}

/** Is the native plugin present in this binary? False on web and on older
 *  binaries running OTA'd JS — those stay on the plain-Preferences path. */
export function isGuardedStoreSupported(): boolean {
    if (!isCapacitor()) return false
    return !!window.Capacitor?.isPluginAvailable?.('NativeBiometric')
}

/** Can the device produce a biometric assertion right now? Strict biometric —
 *  no device-credential fallback, matching the storage's access control. */
export async function isBiometryEnrolled(): Promise<boolean> {
    if (!isGuardedStoreSupported()) return false
    try {
        const { NativeBiometric } = await loadPlugin()
        const result = await NativeBiometric.isAvailable({ useFallback: false })
        return !!result.isAvailable
    } catch {
        return false
    }
}

/**
 * Persists the token under biometric access control. Never shows a prompt:
 * callers must check canWriteSilently() first on Android (iOS writes are
 * always silent). Throws on failure — the caller decides whether the plain
 * fallback or memory-only is acceptable.
 */
export async function guardedWrite(token: string): Promise<void> {
    const { NativeBiometric } = await loadPlugin()
    await NativeBiometric.setCredentials({
        server: SERVER,
        username: USERNAME,
        password: token,
        accessControl: BIOMETRY_CURRENT_SET,
        authValidityDuration: AUTH_VALIDITY_S,
    })
    if (!isAndroidNative()) return
    // an Android write outside the validity window showed its own prompt; a
    // successful one (re)opens the window either way
    lastAuthAt = Date.now()
}

/**
 * Releases the token — this call shows the OS biometric sheet and only
 * resolves with the secret after a successful assertion. Rejections carry a
 * GuardedStoreError:
 *   'cancelled'  — user dismissed / failed / temporary lockout; stay locked, retry.
 *   'not-found'  — no guarded item, or the key was invalidated by biometric
 *                  re-enrollment (both platforms surface enrollment changes
 *                  this way; Android's plugin self-deletes the dead key).
 *                  Treat as session gone.
 *   'transient'  — anything else; stay locked with retry + logout escape hatch.
 */
export async function guardedRead(reason: string): Promise<string> {
    const { NativeBiometric } = await loadPlugin()
    try {
        const credentials = await NativeBiometric.getSecureCredentials({ server: SERVER, reason })
        lastAuthAt = Date.now()
        return credentials.password
    } catch (error) {
        throw new GuardedStoreError(classifyReadError(error), error instanceof Error ? error.message : String(error))
    }
}

/** Best-effort delete of the guarded item; never throws. */
export async function guardedDelete(): Promise<void> {
    try {
        const { NativeBiometric } = await loadPlugin()
        await NativeBiometric.deleteCredentials({ server: SERVER })
    } catch {}
}

/** Would a guardedWrite right now complete without an OS prompt? */
export function canWriteSilently(): boolean {
    if (!isAndroidNative()) return true
    return Date.now() - lastAuthAt < AUTH_VALIDITY_S * 1000 - SILENT_WRITE_MARGIN_MS
}

/*
 * Unified plugin error codes (convertToPluginErrorCode on Android, mirrored by
 * the iOS plugin): 16/15 user or system cancel, 10 failed attempt, 4 temporary
 * lockout, 2 permanent lockout — all retryable-while-locked. 21 no protected
 * credentials (also how re-enrollment invalidation surfaces on both
 * platforms), 3 no biometrics enrolled — session gone. Everything else is
 * transient. Unknown codes deliberately stay locked (fail closed) — the lock
 * screen's Log out button is the escape hatch.
 */
function classifyReadError(error: unknown): GuardedReadError {
    const code = typeof error === 'object' && error !== null ? String((error as { code?: unknown }).code ?? '') : ''
    if (['16', '15', '10', '4', '2'].includes(code)) return 'cancelled'
    if (['21', '3'].includes(code)) return 'not-found'
    const message = error instanceof Error ? error.message : ''
    if (/no protected credentials|not found/i.test(message)) return 'not-found'
    return 'transient'
}
