/**
 * Mirror of the wire codes peanut-api-ts emits (`src/errors/error-codes.ts`).
 *
 * Hand-maintained rather than derived from `api.generated.ts`: the backend
 * declares `code` as an open string in the shared error schema (a per-route
 * literal union would force every route to enumerate its codes and balloon the
 * openapi snapshot), so there is no generated union to narrow against.
 *
 * A code the backend adds but this list omits simply falls through to the
 * message matchers in `friendly-error.utils` — the same behaviour as before the
 * contract existed. That is the intended failure mode: a mismatch is a missing
 * translation, never a crash.
 */
export const API_ERROR_CODES = {
    USER_OP_REVERTED: 'USER_OP_REVERTED',
    /** Bundler REFUSED the signed op at validation — definitive, nothing was
     *  executed. Emitted only by the modern broadcast-first mixed routes; an
     *  unknown/internal/already-known transport outcome never gets it. */
    USER_OP_REJECTED: 'USER_OP_REJECTED',
    INSUFFICIENT_COLLATERAL: 'INSUFFICIENT_COLLATERAL',
    WITHDRAWAL_COOLDOWN_ACTIVE: 'WITHDRAWAL_COOLDOWN_ACTIVE',
    WITHDRAWAL_SIGNATURE_COOLDOWN: 'WITHDRAWAL_SIGNATURE_COOLDOWN',
    WITHDRAWAL_SIGNATURE_EXPIRED: 'WITHDRAWAL_SIGNATURE_EXPIRED',
    WITHDRAWAL_SUBMISSION_FAILED: 'WITHDRAWAL_SUBMISSION_FAILED',
    STALE_CARD_APPROVAL: 'STALE_CARD_APPROVAL',
    /** Rain rotated the controller (or the grant is bound to the old one), on an
     *  attempt with NO financial effect: refused by `/prepare` or by
     *  `verifyRainWithdrawal` before any order/claim/broadcast, or — for
     *  `POST /rain/cards/withdraw/submit` only — after a proven no-effect late
     *  failure (final DB mismatch before send, or an inner userOp receipt that
     *  strictly reported `success === false`) with the controller actually
     *  changed. The one failure the client may recover from in-flow by
     *  re-preparing; never inferred from another code. */
    RAIN_CONTROLLER_CHANGED: 'RAIN_CONTROLLER_CHANGED',
    NO_APPROVED_CARD: 'NO_APPROVED_CARD',
    NO_ACTIVE_CARD: 'NO_ACTIVE_CARD',
    NO_COLLATERAL_CONTRACT: 'NO_COLLATERAL_CONTRACT',
    CARD_SECRETS_RATE_LIMITED: 'CARD_SECRETS_RATE_LIMITED',
    MANTECA_KYC_REQUIRED: 'MANTECA_KYC_REQUIRED',
    /** The pool-lock sender carried an id the provider refuses. The user is
     *  verified, so a KYC prompt is a dead end: support corrects the id on
     *  file. Deterministic, never retried. */
    MANTECA_SENDER_REJECTED: 'MANTECA_SENDER_REJECTED',
    MANTECA_TEMPORARILY_UNAVAILABLE: 'MANTECA_TEMPORARILY_UNAVAILABLE',
    QR_PAYMENT_CANCELLED: 'QR_PAYMENT_CANCELLED',
    TRANSFER_ALREADY_CONFIRMED: 'TRANSFER_ALREADY_CONFIRMED',
    /** Bridge refused a saved bank account: it belongs to an earlier Bridge
     *  customer of the user. The API has switched the account off; the user
     *  adds it again. */
    BANK_ACCOUNT_NOT_USABLE: 'BANK_ACCOUNT_NOT_USABLE',
    CHAIN_INFRA_UNAVAILABLE: 'CHAIN_INFRA_UNAVAILABLE',
    LINK_ALREADY_CLAIMED: 'LINK_ALREADY_CLAIMED',
    BELOW_MIN_BRIDGE_AMOUNT: 'BELOW_MIN_BRIDGE_AMOUNT',
    XCHAIN_WITHDRAW_LIMIT_REACHED: 'XCHAIN_WITHDRAW_LIMIT_REACHED',
    DEPOSIT_ACCOUNTS_NOT_AVAILABLE: 'DEPOSIT_ACCOUNTS_NOT_AVAILABLE',
    XCHAIN_WITHDRAW_DISABLED: 'XCHAIN_WITHDRAW_DISABLED',
} as const

export type ApiErrorCode = (typeof API_ERROR_CODES)[keyof typeof API_ERROR_CODES]

/**
 * Backend-authored error carrying the API's stable, locale-independent
 * discriminant.
 *
 * `message` stays the backend's English string so Sentry grouping — and any
 * client running against an API that predates the code contract — keeps
 * working unchanged. `code` is what the UI should actually branch on.
 *
 * See peanut-api-ts `src/errors/error-codes.ts` for the emitting side.
 */
export class ApiError extends Error {
    readonly status: number
    readonly code: string | undefined
    /** Seconds until a rate-limited or cooled-down action can be retried, when the backend sent one. */
    readonly retryAfterSec: number | undefined

    constructor(message: string, opts: { status: number; code?: string; retryAfterSec?: number; cause?: unknown }) {
        super(message, { cause: opts.cause })
        this.name = 'ApiError'
        this.status = opts.status
        this.code = opts.code
        this.retryAfterSec = opts.retryAfterSec
    }
}

/**
 * Reads a wire discriminant off any thrown value.
 *
 * Duck-typed rather than `instanceof ApiError` on purpose: services that
 * haven't migrated yet still throw plain `Error`s with a `code` copied off the
 * response body, and errors that crossed a serialization boundary lose their
 * prototype.
 *
 * The returned string MUST be looked up in an allow-list, never used as a
 * translation key directly — plenty of third-party errors carry an unrelated
 * `.code` (ethers uses `NETWORK_ERROR`, `CALL_EXCEPTION`; EIP-1193 wallets use
 * numeric codes like 4001). The `typeof === 'string'` guard drops the numeric
 * family; the allow-list in `friendly-error.utils` drops the rest so they fall
 * through to the message matchers exactly as they do today.
 */
export function wireErrorCode(error: unknown): string | undefined {
    if (!error || typeof error !== 'object') return undefined
    const code = (error as { code?: unknown }).code
    return typeof code === 'string' && code.length > 0 ? code : undefined
}

/**
 * Reads the HTTP status off a thrown value, but ONLY for our own ApiError
 * (matched by name, not instanceof, to survive serialization boundaries).
 * Third-party errors carry unrelated numeric fields (ethers `status`,
 * EIP-1193 codes), so an unguarded read would misclassify them.
 */
export function apiErrorStatus(error: unknown): number | undefined {
    if (!error || typeof error !== 'object') return undefined
    if ((error as { name?: unknown }).name !== 'ApiError') return undefined
    const status = (error as { status?: unknown }).status
    return typeof status === 'number' && Number.isFinite(status) ? status : undefined
}

/** Builds an ApiError from a failed Response, best-effort parsing the body for
 *  the backend's `message`/`code`. Never throws. */
export async function apiErrorFromResponse(response: Response, fallbackMessage: string): Promise<ApiError> {
    let message = fallbackMessage
    let code: string | undefined
    let retryAfterSec: number | undefined
    try {
        const body = await response.text()
        const parsed = JSON.parse(body) as {
            message?: unknown
            error?: unknown
            code?: unknown
            retryAfterSec?: unknown
        }
        if (typeof parsed.message === 'string' && parsed.message) message = parsed.message
        else if (typeof parsed.error === 'string' && parsed.error) message = parsed.error
        if (typeof parsed.code === 'string' && parsed.code) code = parsed.code
        // Older submit routes put the wire discriminant in `error`.
        else if (Object.values(API_ERROR_CODES).some((value) => value === parsed.error)) code = parsed.error as string
        if (
            typeof parsed.retryAfterSec === 'number' &&
            Number.isFinite(parsed.retryAfterSec) &&
            parsed.retryAfterSec > 0
        ) {
            retryAfterSec = parsed.retryAfterSec
        }
    } catch {
        // unreadable or non-JSON body — keep the fallback message
    }
    return new ApiError(message, { status: response.status, code, retryAfterSec })
}
