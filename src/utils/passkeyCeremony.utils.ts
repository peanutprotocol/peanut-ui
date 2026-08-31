import { captureException } from '@/utils/sentry-lazy'
import { isCapacitor } from '@/utils/capacitor'
import { setAuthToken } from '@/utils/auth-token'

/**
 * Guards for the passkey ceremony (TASK-21782).
 *
 * The zerodev `toWebAuthnKey()` call can pend forever on native Android —
 * a tap that races the async `autoShimWebAuthn` install runs the webview's
 * raw WebAuthn (broken in Capacitor), and the Credential Manager callback
 * can silently never fire. Without a timeout, `isLoggingIn`/`isRegistering`
 * stays true and the button is dead until the app is killed.
 */

// WebAuthn UI sheets time out on their own around 60s; racing shorter would
// cancel a ceremony the user is legitimately still completing.
export const CEREMONY_TIMEOUT_MS = 60_000

// Web cross-device (QR/hybrid) and security-key ceremonies legitimately run
// minutes, so the web bound is generous — it exists only so a ceremony the
// browser never settles can't leave isLoggingIn true (and the landing
// buttons dead) forever.
export const WEB_CEREMONY_TIMEOUT_MS = 300_000

// The shim install is a dynamic import + native plugin call — normally
// sub-second. 3s covers a slow cold start without stalling a real tap.
export const SHIM_WAIT_TIMEOUT_MS = 3_000
const SHIM_POLL_INTERVAL_MS = 100

export class CeremonyTimeoutError extends Error {
    constructor(ms: number) {
        super(`passkey ceremony did not settle within ${ms}ms`)
        this.name = 'CeremonyTimeoutError'
    }
}

export class PasskeyShimNotReadyError extends Error {
    constructor(ms: number) {
        super(`native passkey shim not installed after ${ms}ms`)
        this.name = 'PasskeyShimNotReadyError'
    }
}

export class PasskeyShimFailedError extends Error {
    constructor() {
        super('native passkey shim install failed — restart required')
        this.name = 'PasskeyShimFailedError'
    }
}

export class CeremonyConflictError extends Error {
    constructor() {
        super('another passkey ceremony is already in progress')
        this.name = 'CeremonyConflictError'
    }
}

/** True for the pre-ceremony / timeout guard errors thrown by this module. */
export const isCeremonyGuardError = (err: unknown): err is Error =>
    err instanceof Error &&
    (err.name === 'CeremonyTimeoutError' ||
        err.name === 'PasskeyShimNotReadyError' ||
        err.name === 'PasskeyShimFailedError' ||
        err.name === 'CeremonyConflictError')

const GUARD_ERROR_TAG: Record<string, string> = {
    CeremonyTimeoutError: 'ceremony_timeout',
    PasskeyShimNotReadyError: 'shim_not_ready',
    PasskeyShimFailedError: 'shim_failed',
    CeremonyConflictError: 'ceremony_conflict',
}

/**
 * One Sentry capture for guard errors from both the login and register catch
 * paths — the tag is derived from the error class, so a new guard error can't
 * silently collapse into the wrong bucket in one copy of a hand-rolled ternary.
 */
export const captureCeremonyGuardError = (
    err: Error,
    flow: 'login' | 'register',
    extra?: Record<string, unknown>
): void => {
    captureException(err, {
        tags: { error_type: `${flow}_${GUARD_ERROR_TAG[err.name] ?? 'ceremony_guard'}` },
        extra: { shimInstalled: isPasskeyShimInstalled(), isCapacitor: isCapacitor(), ...extra },
    })
}

type ShimGlobals = typeof globalThis & {
    __capgoPasskeyShimInstalled?: unknown
    __capgoPasskeyShimFailed?: unknown
}

export const isPasskeyShimInstalled = (): boolean => (globalThis as ShimGlobals).__capgoPasskeyShimInstalled === true

// Set by PeanutProvider when the shim install chain rejects — lets a login
// tap fail immediately with honest "restart" copy instead of burning the
// poll window on an install that will never arrive.
export const markPasskeyShimFailed = (): void => {
    ;(globalThis as ShimGlobals).__capgoPasskeyShimFailed = true
}
const hasPasskeyShimFailed = (): boolean => (globalThis as ShimGlobals).__capgoPasskeyShimFailed === true

/**
 * Resolves once the capgo passkey shim has patched `navigator.credentials`;
 * rejects with `PasskeyShimFailedError` when the install is known-dead, or
 * `PasskeyShimNotReadyError` if it hasn't landed after `timeoutMs`.
 * Rejecting (instead of proceeding) is deliberate: the un-shimmed webview
 * WebAuthn call is exactly the silent-hang this file exists to prevent.
 */
export const waitForPasskeyShim = async (timeoutMs: number = SHIM_WAIT_TIMEOUT_MS): Promise<void> => {
    const deadline = Date.now() + timeoutMs
    while (!isPasskeyShimInstalled()) {
        if (hasPasskeyShimFailed()) throw new PasskeyShimFailedError()
        if (Date.now() >= deadline) throw new PasskeyShimNotReadyError(timeoutMs)
        await new Promise((resolve) => setTimeout(resolve, SHIM_POLL_INTERVAL_MS))
    }
}

// Ceremony-in-flight tracking. Ceremonies are serialized (guardPasskeyCeremony
// rejects a second concurrent one), so the single active window always has one
// owner. native-auth-capture STASHES a /passkeys/*/verify token while a
// ceremony is active; the token is persisted only when the owning ceremony
// RESOLVES — a verify response from a ceremony that timed out or was told
// "failed" can never end up persisted (the guard discards the stash on
// failure), even when it lands while a retry ceremony is running.
let ceremonySeq = 0
let activeCeremonyId: number | null = null
let stashedVerifyToken: string | null = null
export const currentCeremonyId = (): number | null => activeCeremonyId
export const isCeremonyStillActive = (id: number | null): boolean => id !== null && id === activeCeremonyId

/**
 * Called by native-auth-capture with the ceremony id captured when the verify
 * REQUEST was issued. Accepted only while that same ceremony is still the
 * active one — a request issued before the current window opened (e.g. a
 * timed-out ceremony's late verify) cannot enter the retry's stash.
 */
export const stashCeremonyVerifyToken = (token: string, issuingCeremonyId: number | null): void => {
    if (isCeremonyStillActive(issuingCeremonyId)) stashedVerifyToken = token
}

/**
 * Races `promise` against a `CeremonyTimeoutError`. On timeout the original
 * promise keeps running but its result is discarded by the caller's `await`,
 * and the ceremony-active window has closed, so a late success can neither
 * log the user in nor store its token.
 */
export const raceCeremonyTimeout = <T>(promise: Promise<T>, ms: number = CEREMONY_TIMEOUT_MS): Promise<T> => {
    let timer: ReturnType<typeof setTimeout>
    const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new CeremonyTimeoutError(ms)), ms)
    })
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer)) as Promise<T>
}

/**
 * The one wrapper both login and register ceremonies route through: on
 * Capacitor, gate on the shim actually being installed and bound the
 * ceremony to CEREMONY_TIMEOUT_MS; on web, use the generous
 * WEB_CEREMONY_TIMEOUT_MS bound (hybrid/QR ceremonies legitimately run for
 * minutes, but an abandoned one must not wedge the UI forever).
 *
 * Ceremonies are mutually exclusive: overlapping windows would make verify
 * tokens unattributable (the fetch layer can't tell whose fetch it sees), so
 * a second concurrent ceremony fails fast with CeremonyConflictError instead
 * of evicting the first's window. The stashed verify token is committed only
 * when the ceremony resolves, so a ceremony reported as failed can never
 * leave a persisted token behind.
 */
export const guardPasskeyCeremony = async <T>(startCeremony: () => Promise<T>): Promise<T> => {
    const native = isCapacitor()
    if (activeCeremonyId !== null) throw new CeremonyConflictError()
    if (native) await waitForPasskeyShim()
    // re-check: another ceremony may have claimed the window during the wait
    if (activeCeremonyId !== null) throw new CeremonyConflictError()
    const ceremonyId = ++ceremonySeq
    activeCeremonyId = ceremonyId
    stashedVerifyToken = null
    try {
        const result = await raceCeremonyTimeout(
            startCeremony(),
            native ? CEREMONY_TIMEOUT_MS : WEB_CEREMONY_TIMEOUT_MS
        )
        if (stashedVerifyToken !== null) setAuthToken(stashedVerifyToken)
        return result
    } finally {
        if (activeCeremonyId === ceremonyId) activeCeremonyId = null
        stashedVerifyToken = null
    }
}
