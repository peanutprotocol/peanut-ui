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
    INSUFFICIENT_COLLATERAL: 'INSUFFICIENT_COLLATERAL',
    WITHDRAWAL_COOLDOWN_ACTIVE: 'WITHDRAWAL_COOLDOWN_ACTIVE',
    WITHDRAWAL_SIGNATURE_COOLDOWN: 'WITHDRAWAL_SIGNATURE_COOLDOWN',
    WITHDRAWAL_SIGNATURE_EXPIRED: 'WITHDRAWAL_SIGNATURE_EXPIRED',
    WITHDRAWAL_SUBMISSION_FAILED: 'WITHDRAWAL_SUBMISSION_FAILED',
    STALE_CARD_APPROVAL: 'STALE_CARD_APPROVAL',
    NO_APPROVED_CARD: 'NO_APPROVED_CARD',
    NO_ACTIVE_CARD: 'NO_ACTIVE_CARD',
    NO_COLLATERAL_CONTRACT: 'NO_COLLATERAL_CONTRACT',
    CARD_SECRETS_RATE_LIMITED: 'CARD_SECRETS_RATE_LIMITED',
    MANTECA_KYC_REQUIRED: 'MANTECA_KYC_REQUIRED',
    TRANSFER_ALREADY_CONFIRMED: 'TRANSFER_ALREADY_CONFIRMED',
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

    constructor(message: string, opts: { status: number; code?: string; cause?: unknown }) {
        super(message, { cause: opts.cause })
        this.name = 'ApiError'
        this.status = opts.status
        this.code = opts.code
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
