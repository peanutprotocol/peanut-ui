import { API_ERROR_CODES, wireErrorCode } from '@/services/api-error'
import type { RainCooldownError } from '@/services/rain'
import { sleepUnlessCancelled } from '@/utils/cancellable-wait'

// Artifact ownership stays client-side and never enters the signed wire payload.
const ephemeralAccounts = new WeakMap<object, string>()

/**
 * Recovery-classification facts about a signed artifact. Client-side only —
 * never part of the wire payload.
 */
export interface SpendArtifactMeta {
    /** Coordinator the prep was built against; compared against the CURRENT one. */
    coordinatorAddress: string
    /** `prep.mixedSpendContract`. Only `broadcast-first-revert-v1` proves that a
     *  returned USER_OP_REVERTED created no provider order. */
    mixedSpendContract?: string
}

const artifactMeta = new WeakMap<object, SpendArtifactMeta>()

export function registerSpendArtifactMeta<T extends object>(artifact: T, meta: SpendArtifactMeta): T {
    artifactMeta.set(artifact, meta)
    return artifact
}

export function getSpendArtifactMeta(artifact: object): SpendArtifactMeta | undefined {
    return artifactMeta.get(artifact)
}
const passkeyAccounts = new Set<string>()
const storageKey = (account: string) => `peanut:sign-spend-passkey:${account.toLowerCase()}`

export function registerEphemeralArtifact<T extends object>(artifact: T, account: string): T {
    ephemeralAccounts.set(artifact, account.toLowerCase())
    return artifact
}

export function requiresPasskeyRetry(account: string): boolean {
    const normalized = account.toLowerCase()
    if (passkeyAccounts.has(normalized)) return true
    try {
        return sessionStorage.getItem(storageKey(normalized)) === 'true'
    } catch {
        return false
    }
}

// These are the confirmed-revert messages from the withdraw and QR
// broadcasters. Timeouts and transport failures may still move funds.
export function isConfirmedRevert(failure: unknown): boolean {
    if (!failure || typeof failure !== 'object') return false
    const { message, error, code } = failure as { message?: unknown; error?: unknown; code?: unknown }
    const detail = typeof message === 'string' ? message : error
    return (
        code === 'USER_OP_REVERTED' ||
        error === 'USER_OP_REVERTED' ||
        (typeof detail === 'string' && detail.startsWith('USER_OP_REVERTED:'))
    )
}

function recordFailure(artifact: object, failure: unknown): void {
    const account = ephemeralAccounts.get(artifact)
    if (!account || !isConfirmedRevert(failure)) return
    passkeyAccounts.add(account)
    try {
        sessionStorage.setItem(storageKey(account), 'true')
    } catch {
        // The in-memory guard still covers retries if storage is unavailable.
    }
}

/** Outcomes that are not failures at all, whatever else the body carries. */
const NON_FAILURE_STATUS = new Set(['PENDING', 'PROCESSING', 'IN_PROGRESS', 'SUBMITTED', 'COMPLETED', 'SUCCESS'])

/**
 * The wire code of an EXPLICIT failure. A pending/successful outcome yields
 * undefined even if a stale `code` rides along, and a code is only ever read
 * from the structured field — never from message text, which no backend
 * guarantees and which can never prove the absence of side effects.
 */
function explicitFailureCode(failure: unknown): string | undefined {
    if (!failure || typeof failure !== 'object') return undefined
    const { status, success } = failure as { status?: unknown; success?: unknown }
    if (success === true) return undefined
    // `status` is an HTTP number on ApiError; only a wire status STRING can
    // declare a pending/settled outcome.
    if (typeof status === 'string' && NON_FAILURE_STATUS.has(status.toUpperCase())) return undefined
    return wireErrorCode(failure)
}

/**
 * Backend proof that a rotation was caught with NO financial effect. Raised by
 * `/prepare`, by verify, and — for the direct wrapper only — by
 * `POST /rain/cards/withdraw/submit` after a proven no-effect late failure
 * (final DB mismatch before send, or `receipt.success === false`). The shared
 * helper, Manteca and card callers never emit it post-order, so the code itself
 * is the trust boundary; nothing else is matched on.
 */
export function isRainControllerChanged(failure: unknown): boolean {
    return explicitFailureCode(failure) === API_ERROR_CODES.RAIN_CONTROLLER_CHANGED
}

/**
 * Structured proof that the backend's broadcast definitively did nothing —
 * a confirmed on-chain revert, or a bundler validation rejection. The ONLY
 * signals a fresh-payment recovery may act on. `isConfirmedRevert` below stays
 * looser (it also accepts the legacy message prefix) because it only drives the
 * observational passkey-retry guard, which never spends money.
 */
export function isStructuredBroadcastFailure(failure: unknown): boolean {
    const code = explicitFailureCode(failure)
    return code === API_ERROR_CODES.USER_OP_REVERTED || code === API_ERROR_CODES.USER_OP_REJECTED
}

/**
 * Recovery outcomes that are CONTROL FLOW, not payment failures: the call site
 * has to act on them (return to review / go idle) instead of showing a failed
 * payment. The original submission failure rides along as `cause`.
 */
export class SpendRecoveryAbortedError extends Error {
    constructor(readonly cause: unknown) {
        super('Spend recovery aborted by the user')
        this.name = 'SpendRecoveryAbortedError'
    }
}

/** The replacement could not be prepared inside the provider quote's lifetime:
 *  the same payment stays open, but the user must confirm refreshed terms.
 *  `retryAfterSec` is Rain's own cooldown when one is still running — the call
 *  site waits it out BEFORE minting a short-lived quote. */
export class SpendRecoveryQuoteReviewError extends Error {
    constructor(
        readonly cause: unknown,
        readonly retryAfterSec?: number
    ) {
        super('Refreshed provider terms need confirmation before this payment can continue')
        this.name = 'SpendRecoveryQuoteReviewError'
    }
}

export function isSpendRecoveryOutcome(error: unknown): boolean {
    return error instanceof SpendRecoveryAbortedError || error instanceof SpendRecoveryQuoteReviewError
}

/** Time reserved for signing and submission after the cooldown. */
const RESIGN_MARGIN_MS = 20_000

/** Callers retain their own error context. */
export type RainCooldownVerdict = 'ready' | 'exceeds-lock' | 'cancelled'

/** Wait only when the cooldown and signing margin fit the current quote. */
export async function awaitRainCooldownWithinLock(args: {
    retryAfterSec: number | null | undefined
    /** Provider quote expiry in epoch milliseconds. */
    lockExpiresAt?: number
    cancelled: () => boolean
}): Promise<RainCooldownVerdict> {
    const retryAfterSec = args.retryAfterSec ?? 0
    const waitMs = retryAfterSec * 1000 + RESIGN_MARGIN_MS
    const fitsLock = retryAfterSec > 0 && !!args.lockExpiresAt && Date.now() + waitMs <= args.lockExpiresAt
    if (!fitsLock) return 'exceeds-lock'
    return (await sleepUnlessCancelled(waitMs - RESIGN_MARGIN_MS, args.cancelled)) ? 'ready' : 'cancelled'
}

export function toQuoteReview(error: RainCooldownError): SpendRecoveryQuoteReviewError {
    return new SpendRecoveryQuoteReviewError(error, error.retryAfterSec ?? undefined)
}

function notifyFailure(onFailure: ((failure: unknown) => void) | undefined, failure: unknown): void {
    try {
        onFailure?.(failure)
    } catch {
        // The submission's own outcome is the contract here.
    }
}

export interface SubmitSignedSpendOptions<A extends object> {
    /** Observes the FINAL failure (thrown, or a resolved confirmed revert). */
    onFailure?: (failure: unknown) => void
    /**
     * Bounded, one-shot recovery: returns a freshly prepared + signed
     * replacement artifact for the same payment, or null when the failure is
     * not provably recoverable. Called at most once per submission.
     */
    recover?: (failure: unknown, artifact: A) => Promise<A | null>
}

/** A resolved response can carry the failure instead of throwing it. */
function resolvedFailure<T>(result: T): unknown | undefined {
    return isConfirmedRevert(result) || isStructuredBroadcastFailure(result) || isRainControllerChanged(result)
        ? result
        : undefined
}

/**
 * Submits a signed artifact, optionally replacing it ONCE after a provably
 * pre-effect failure. `submit` receives the artifact actually being sent, so
 * the caller builds its wire body from that and never from the captured one.
 * Success and unknown/pending outcomes are returned untouched.
 */
export async function submitSignedSpend<T, A extends object>(
    artifact: A,
    submit: (candidate: A) => Promise<T>,
    opts: SubmitSignedSpendOptions<A> = {}
): Promise<T> {
    const attempt = async (candidate: A): Promise<{ result: T; failure?: unknown } | { failure: unknown }> => {
        try {
            const result = await submit(candidate)
            recordFailure(candidate, result)
            return { result, failure: resolvedFailure(result) }
        } catch (error) {
            recordFailure(candidate, error)
            return { failure: error }
        }
    }

    const settle = (outcome: Awaited<ReturnType<typeof attempt>>): T => {
        if (outcome.failure !== undefined) notifyFailure(opts.onFailure, outcome.failure)
        if (!('result' in outcome)) throw outcome.failure
        return outcome.result as T
    }

    const first = await attempt(artifact)
    if (first.failure === undefined || !opts.recover) return settle(first)

    // A recovery that ends in a typed outcome (user abort, refreshed quote to
    // confirm) is control flow the call site must handle — propagate it with
    // the original failure as `cause`. Anything UNEXPECTED from the recovery is
    // swallowed instead, so the money-truth of the first attempt still stands.
    const replacement = await opts.recover(first.failure, artifact).catch((recoveryError: unknown) => {
        if (isSpendRecoveryOutcome(recoveryError)) throw recoveryError
        console.warn('[submitSignedSpend] recovery did not complete:', (recoveryError as Error)?.message)
        return null
    })
    if (!replacement) return settle(first)
    return settle(await attempt(replacement))
}
