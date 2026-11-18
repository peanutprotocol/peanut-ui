import { beginAndroidPasskeyScope, waitForExpiredAndroidPasskeyScope } from './android-passkey-scope'
import { ANDROID_PASSKEY_SETTLE_GRACE_MS } from './android-passkey-controller'
import { addBreadcrumb, captureException } from '@/utils/sentry-lazy'
import { isCapacitor } from '@/utils/capacitor'
import { setAuthToken } from '@/utils/auth-token'
import { setCachedStepUpToken } from '@/services/step-up-cache'
import {
    beginCeremonyTiming,
    openCredentialCall,
    type CeremonyTiming,
    type CeremonyTimeoutOutcome,
} from '@/utils/webauthn-ceremony-telemetry'
import { watchNativeAppActive } from '@/utils/native-app-state'

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

// Android counts only time the app is in front, and while the native request is pending (the sheet
// is up) it waits this long instead of CEREMONY_TIMEOUT_MS. Native timeouts at 60 s landed at a
// median of 59.7 s, so that bound cut off people still using the sheet. Three minutes covers a slow
// fingerprint retry or the PIN fallback, and still frees the button when the sheet's callback never fires.
export const ANDROID_SHEET_HUNG_MS = 180_000

// After the person comes back to the app, the ceremony gets this much more foreground time. A sheet
// that closed delivers its native result within about 170 ms; one that is still open stays usable.
export const ANDROID_RETURN_GRACE_MS = 30_000
const SHEET_RECHECK_MS = 1_000

// Web cross-device (QR/hybrid) and security-key ceremonies legitimately run
// minutes, so the web bound is generous — it exists only so a ceremony the
// browser never settles can't leave isLoggingIn true (and the landing
// buttons dead) forever.
export const WEB_CEREMONY_TIMEOUT_MS = 300_000

// The shim install is a dynamic import + native plugin call — normally
// sub-second. 3s covers a slow cold start without stalling a real tap.
export const SHIM_WAIT_TIMEOUT_MS = 3_000
const SHIM_POLL_INTERVAL_MS = 100

/**
 * `left_app`: on Android the app went to the background during the ceremony (or a full-screen
 * provider screen covered it) and the ceremony did not settle after the person came back.
 * `sheet_hung`: the app stayed in front and the native sheet was still open.
 * `network_hung` (Android): no sheet was open, so the wait was on the network before or after it.
 * Web and iOS do not track the app state, so their timeouts are always `sheet_hung`.
 */
export class CeremonyTimeoutError extends Error {
    readonly outcome: CeremonyTimeoutOutcome
    constructor(ms: number, outcome: CeremonyTimeoutOutcome = 'sheet_hung') {
        super(`passkey ceremony did not settle within ${ms}ms`)
        this.name = 'CeremonyTimeoutError'
        this.outcome = outcome
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

/** The caller retired the ceremony (the user chose another way in); its late result is discarded. */
export class CeremonyCancelledError extends Error {
    constructor() {
        super('passkey ceremony was cancelled by the caller')
        this.name = 'CeremonyCancelledError'
    }
}

/** True for the pre-ceremony / timeout guard errors thrown by this module. */
export const isCeremonyGuardError = (err: unknown): err is Error =>
    err instanceof Error &&
    (err.name === 'CeremonyTimeoutError' ||
        err.name === 'PasskeyShimNotReadyError' ||
        err.name === 'PasskeyShimFailedError' ||
        err.name === 'CeremonyConflictError' ||
        err.name === 'PasskeyCleanupPendingError' ||
        err.name === 'PasskeyRequestSettlingError')

const GUARD_ERROR_TAG: Record<string, string> = {
    CeremonyTimeoutError: 'ceremony_timeout',
    PasskeyShimNotReadyError: 'shim_not_ready',
    PasskeyShimFailedError: 'shim_failed',
    CeremonyConflictError: 'ceremony_conflict',
    PasskeyCleanupPendingError: 'cleanup_pending',
    PasskeyRequestSettlingError: 'request_settling',
}

// A second tap while a ceremony owns the window is a rejected interaction, not
// a second passkey failure. Keep the first conflict useful for diagnostics but
// do not let a rapid burst of losing taps multiply the exception count. The
// entry is removed when its owning ceremony ends, so a later real conflict is
// still reportable.
const reportedConflictCeremonies = new Set<number>()

/**
 * Capture guard errors from both the login and register catch paths — the tag
 * is derived from the error class, so a new guard error cannot silently
 * collapse into the wrong bucket in one copy of a hand-rolled ternary.
 * Conflicts are limited to one exception per active ceremony above; later
 * losing taps remain breadcrumbs rather than new exception events.
 */
export const captureCeremonyGuardError = (
    err: Error,
    flow: 'login' | 'register' | 'sign',
    extra?: Record<string, unknown>
): void => {
    if (err.name === 'CeremonyConflictError') {
        const ceremonyId = currentCeremonyId()
        if (ceremonyId !== null) {
            if (reportedConflictCeremonies.has(ceremonyId)) {
                addBreadcrumb({
                    category: 'webauthn.ceremony',
                    level: 'info',
                    message: `suppressed duplicate ${flow} ceremony conflict`,
                    data: { ceremonyId },
                })
                return
            }
            reportedConflictCeremonies.add(ceremonyId)
        }
    }
    const osCall = openCredentialCall()
    captureException(err, {
        tags: { error_type: `${flow}_${GUARD_ERROR_TAG[err.name] ?? 'ceremony_guard'}` },
        extra: {
            shimInstalled: isPasskeyShimInstalled(),
            isCapacitor: isCapacitor(),
            osCallInFlight: osCall?.inFlight,
            osCallElapsedMs: osCall?.elapsedMs,
            ...extra,
        },
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
// owner. passkey-auth-capture STASHES a /passkeys/*/verify token while a
// ceremony is active; the token is persisted only when the owning ceremony
// RESOLVES — a verify response from a ceremony that timed out or was told
// "failed" can never end up persisted (the guard discards the stash on
// failure), even when it lands while a retry ceremony is running.
let ceremonySeq = 0
let activeCeremonyId: number | null = null
let stashedVerifyToken: string | null = null
type StashedStepUp = { token: string; expiresIn: number }
let stashedStepUp: StashedStepUp | null = null
// Read through a function: TS narrows the module `let` to null across the
// await below and cannot see the fetch wrapper assigning it meanwhile.
const takeStashedStepUp = (): StashedStepUp | null => stashedStepUp
export const currentCeremonyId = (): number | null => activeCeremonyId
export const isCeremonyStillActive = (id: number | null): boolean => id !== null && id === activeCeremonyId

/**
 * Called by passkey-auth-capture with the ceremony id captured when the verify
 * REQUEST was issued. Accepted only while that same ceremony is still the
 * active one — a request issued before the current window opened (e.g. a
 * timed-out ceremony's late verify) cannot enter the retry's stash.
 */
export const stashCeremonyVerifyToken = (token: string, issuingCeremonyId: number | null): void => {
    if (isCeremonyStillActive(issuingCeremonyId)) stashedVerifyToken = token
}

/** Same window rule as the session token: the step-up proof a login mints is committed only with its ceremony. */
export const stashCeremonyStepUpToken = (token: string, expiresIn: number, issuingCeremonyId: number | null): void => {
    if (isCeremonyStillActive(issuingCeremonyId)) stashedStepUp = { token, expiresIn }
}

/**
 * Races `promise` against a `CeremonyTimeoutError`. On timeout the original
 * promise keeps running but its result is discarded by the caller's `await`,
 * and the ceremony-active window has closed, so a late success can neither
 * log the user in nor store its token.
 */
export const raceCeremonyTimeout = <T>(
    promise: Promise<T>,
    ms: number = CEREMONY_TIMEOUT_MS,
    onTimeout?: () => void
): Promise<T> => {
    let timer: ReturnType<typeof setTimeout>
    const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
            onTimeout?.()
            reject(new CeremonyTimeoutError(ms))
        }, ms)
    })
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer)) as Promise<T>
}

/**
 * The Android form of raceCeremonyTimeout. The budget pauses while the app is in the background,
 * so a person who switches apps is not timed out behind their back. The background signal is
 * appStateChange, which the passkey sheet itself does not trigger (see native-app-state).
 */
const raceAndroidCeremony = <T>(
    promise: Promise<T>,
    onTimeout: (outcome: CeremonyTimeoutOutcome) => void
): Promise<T> => {
    let usedMs = 0
    let activeSince: number | undefined = Date.now()
    // Foreground time already used when the app last came back; undefined while it never left.
    let usedAtReturn: number | undefined
    // Foreground time used when the native sheet last settled; undefined while it is open or never opened.
    let sheetSettledAt: number | undefined
    let sawSheet = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let stopWatching = () => {}
    const timeout = new Promise<never>((_, reject) => {
        const check = () => {
            clearTimeout(timer)
            if (activeSince === undefined) return
            const spent = usedMs + Date.now() - activeSince
            const sheetOpen = openCredentialCall()?.inFlight === true
            if (sheetOpen) sheetSettledAt = undefined
            else if (sheetSettledAt === undefined && sawSheet) sheetSettledAt = spent
            sawSheet ||= sheetOpen
            // The network after the sheet gets its own 60 s; it must not inherit the sheet's longer bound.
            const budget = sheetOpen ? ANDROID_SHEET_HUNG_MS : (sheetSettledAt ?? 0) + CEREMONY_TIMEOUT_MS
            const limit = usedAtReturn === undefined ? budget : Math.min(budget, usedAtReturn + ANDROID_RETURN_GRACE_MS)
            if (spent < limit) {
                // Look again every second: nothing else tells this timer the sheet opened or closed, and a
                // short sheet must still give the network after it a full 60 s.
                timer = setTimeout(check, Math.min(limit - spent, SHEET_RECHECK_MS))
                return
            }
            const outcome = usedAtReturn !== undefined ? 'left_app' : sheetOpen ? 'sheet_hung' : 'network_hung'
            onTimeout(outcome)
            reject(new CeremonyTimeoutError(spent, outcome))
        }
        stopWatching = watchNativeAppActive((isActive) => {
            if (isActive && activeSince === undefined) {
                activeSince = Date.now()
                usedAtReturn = usedMs
                check()
            } else if (!isActive && activeSince !== undefined) {
                usedMs += Date.now() - activeSince
                activeSince = undefined
                clearTimeout(timer)
            }
        })
        check()
    })
    return Promise.race([promise, timeout]).finally(() => {
        clearTimeout(timer)
        stopWatching()
    }) as Promise<T>
}

/**
 * A browser keeps an abandoned get()/create() pending and rejects the retry
 * with "A request is already pending" (PEANUT-UI-TBB). The ceremony's abort
 * signal belongs to @simplewebauthn's shared service, which the zerodev SDK
 * and step-up both start through. The native shim ignores a mid-call abort.
 */
const cancelBrowserCeremony = (): void => {
    void import('@simplewebauthn/browser')
        .then(({ WebAuthnAbortService }) => WebAuthnAbortService.cancelCeremony())
        .catch(() => {})
}

/**
 * The one wrapper both login and register ceremonies route through: on
 * Capacitor, gate on the shim actually being installed and bound the
 * ceremony to CEREMONY_TIMEOUT_MS (Android: raceAndroidCeremony); on web, use the generous
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
export const guardPasskeyCeremony = async <T>(
    startCeremony: () => Promise<T>,
    { cancel, timing: suppliedTiming }: { cancel?: AbortSignal; timing?: CeremonyTiming } = {}
): Promise<T> => {
    const startedAt = Date.now()
    const native = isCapacitor()
    if (cancel?.aborted) throw new CeremonyCancelledError()
    if (activeCeremonyId !== null) throw new CeremonyConflictError()
    let timing = suppliedTiming
    try {
        timing ??= beginCeremonyTiming?.(startedAt)
    } catch {}
    let admitted = false
    try {
        if (native) await waitForPasskeyShim()
        const expiredScope = native ? waitForExpiredAndroidPasskeyScope(ANDROID_PASSKEY_SETTLE_GRACE_MS) : undefined
        if (expiredScope) await expiredScope
        // re-check: another ceremony may have claimed the window, or the caller cancelled, during the wait
        if (activeCeremonyId !== null) throw new CeremonyConflictError()
        if (cancel?.aborted) throw new CeremonyCancelledError()
        const androidScope = native ? beginAndroidPasskeyScope() : undefined
        const ceremonyId = ++ceremonySeq
        activeCeremonyId = ceremonyId
        admitted = true
        try {
            timing?.activate()
        } catch {}
        stashedVerifyToken = null
        stashedStepUp = null
        let stopListening = () => {}
        try {
            let operation: Promise<T>
            try {
                timing?.operationStarted()
            } catch {}
            try {
                operation = startCeremony()
            } catch (error) {
                try {
                    timing?.operationSettled()
                } catch {}
                androidScope?.finish()
                throw error
            }
            // Keep the scope after a UI timeout until the SDK continuation terminates or the next
            // ceremony retires it. An options response arriving late cannot open another native prompt.
            const scopedOperation = operation.finally(() => {
                try {
                    timing?.operationSettled()
                } catch {}
                androidScope?.finish()
            })
            // Rejecting closes the window in `finally`, so an assertion that lands later can't commit a session.
            const cancelled = cancel
                ? new Promise<never>((_, reject) => {
                      const onAbort = () => reject(new CeremonyCancelledError())
                      cancel.addEventListener('abort', onAbort, { once: true })
                      stopListening = () => cancel.removeEventListener('abort', onAbort)
                  })
                : undefined
            const raced = cancelled ? Promise.race([scopedOperation, cancelled]) : scopedOperation
            const result = await (androidScope
                ? raceAndroidCeremony(raced, (outcome) => {
                      try {
                          timing?.timeout(outcome)
                      } catch {}
                      androidScope.expire()
                  })
                : raceCeremonyTimeout(raced, native ? CEREMONY_TIMEOUT_MS : WEB_CEREMONY_TIMEOUT_MS, () => {
                      try {
                          timing?.timeout()
                      } catch {}
                      if (!native) cancelBrowserCeremony()
                  }))
            // The ceremony can settle in the same turn as a retirement; a retired login must not commit a session.
            if (cancel?.aborted) throw new CeremonyCancelledError()
            if (stashedVerifyToken !== null) setAuthToken(stashedVerifyToken)
            const stepUp = takeStashedStepUp()
            if (stepUp !== null) setCachedStepUpToken(stepUp.token, stepUp.expiresIn)
            return result
        } finally {
            stopListening()
            if (activeCeremonyId === ceremonyId) activeCeremonyId = null
            reportedConflictCeremonies.delete(ceremonyId)
            stashedVerifyToken = null
            stashedStepUp = null
        }
    } catch (error) {
        try {
            if (admitted) timing?.finish(error)
        } catch {}
        throw error
    } finally {
        try {
            if (!suppliedTiming) {
                if (admitted) timing?.finish()
                timing?.dispose()
            }
        } catch {}
    }
}
