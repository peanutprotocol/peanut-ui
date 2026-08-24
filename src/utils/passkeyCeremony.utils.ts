import { isCapacitor } from '@/utils/capacitor'

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
// cancel a ceremony the user is legitimately still completing. Native-only:
// on web, cross-device (QR/hybrid) and security-key ceremonies routinely run
// minutes, and the silent-hang this defends against is a Capacitor defect.
export const CEREMONY_TIMEOUT_MS = 60_000

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

/** True for the pre-ceremony / timeout guard errors thrown by this module. */
export const isCeremonyGuardError = (err: unknown): err is Error =>
    err instanceof Error &&
    (err.name === 'CeremonyTimeoutError' ||
        err.name === 'PasskeyShimNotReadyError' ||
        err.name === 'PasskeyShimFailedError')

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

// Ceremony-in-flight tracking. native-auth-capture only persists a
// /passkeys/*/verify token while a ceremony is active, so a verify response
// landing AFTER a timeout already told the user "failed" cannot leave a
// half-authenticated session behind.
let activeCeremonies = 0
export const isPasskeyCeremonyActive = (): boolean => activeCeremonies > 0

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
 * ceremony to CEREMONY_TIMEOUT_MS; on web, run it untouched (hybrid/QR
 * ceremonies legitimately run for minutes). Tracks the active window for
 * native-auth-capture either way.
 */
export const guardPasskeyCeremony = async <T>(startCeremony: () => Promise<T>): Promise<T> => {
    const native = isCapacitor()
    if (native) await waitForPasskeyShim()
    activeCeremonies++
    try {
        return native ? await raceCeremonyTimeout(startCeremony()) : await startCeremony()
    } finally {
        activeCeremonies = Math.max(0, activeCeremonies - 1)
    }
}
