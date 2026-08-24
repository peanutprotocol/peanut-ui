/**
 * Guards for the passkey login ceremony (TASK-21782).
 *
 * The zerodev `toWebAuthnKey()` call can pend forever on native Android —
 * a tap that races the async `autoShimWebAuthn` install runs the webview's
 * raw WebAuthn (broken in Capacitor), and the Credential Manager callback
 * can silently never fire. Without a timeout, `isLoggingIn` stays true and
 * the Log In button is dead until the app is killed.
 */

// WebAuthn UI sheets time out on their own around 60s; racing shorter would
// cancel a ceremony the user is legitimately still completing.
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

export const isPasskeyShimInstalled = (): boolean =>
    (globalThis as typeof globalThis & { __capgoPasskeyShimInstalled?: unknown }).__capgoPasskeyShimInstalled === true

/**
 * Resolves once the capgo passkey shim has patched `navigator.credentials`;
 * rejects with `PasskeyShimNotReadyError` if it hasn't after `timeoutMs`.
 * Rejecting (instead of proceeding) is deliberate: the un-shimmed webview
 * WebAuthn call is exactly the silent-hang this file exists to prevent.
 */
export const waitForPasskeyShim = async (timeoutMs: number = SHIM_WAIT_TIMEOUT_MS): Promise<void> => {
    const deadline = Date.now() + timeoutMs
    while (!isPasskeyShimInstalled()) {
        if (Date.now() >= deadline) throw new PasskeyShimNotReadyError(timeoutMs)
        await new Promise((resolve) => setTimeout(resolve, SHIM_POLL_INTERVAL_MS))
    }
}

/**
 * Races `promise` against a `CeremonyTimeoutError`. On timeout the original
 * promise keeps running but its result is discarded by the caller's `await`,
 * so a late ceremony success can never log the user in after we gave up.
 */
export const raceCeremonyTimeout = <T>(promise: Promise<T>, ms: number = CEREMONY_TIMEOUT_MS): Promise<T> => {
    let timer: ReturnType<typeof setTimeout>
    const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new CeremonyTimeoutError(ms)), ms)
    })
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer)) as Promise<T>
}
