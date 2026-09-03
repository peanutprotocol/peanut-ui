import { wireErrorCode } from '@/services/api-error'

/**
 * One table for every `/manteca/qr-payment/init` refusal the screen reacts to.
 *
 * Previously the same rejection was described in three places that could drift:
 * a prose substring list for the retry gate, a separate wire-code list for the
 * KYC case, and a copy mapping keyed on neither. A code added to one and not
 * the others produced exactly the defects this file exists to prevent — a
 * deterministic refusal that still burned four POSTs, or actionable copy the
 * retry gate never let the user see.
 *
 * peanut-api-ts sends every one of these as a registry `code`
 * (`src/errors/error-codes.ts`). Older API builds put the same token in the
 * `error` field, which the service copies into `message` — so `qrInitCode`
 * reads the code first and falls back to an ALLOW-LISTED message match. The
 * fallback never guesses: only tokens already in this table are recognised.
 */
export const QR_INIT_CODE = {
    CAP: 'MANTECA_SOURCE_OVER_MONTHLY_CAP',
    MERCHANT_VOLUME: 'MANTECA_MERCHANT_VOLUME_NEAR_CAP',
    MERCHANT_REFUND: 'MANTECA_MERCHANT_RECENT_REFUND',
    NOT_PROVISIONED: 'MANTECA_USER_NOT_PROVISIONED',
    KYC: 'MANTECA_KYC_REQUIRED',
    PIX_MIN_AMOUNT: 'PIX_MIN_AMOUNT',
    PIX_RECURRING: 'PIX_RECURRING_NOT_SUPPORTED',
    MISSING_AMOUNT: 'PAYMENT_DESTINATION_MISSING_AMOUNT',
    EXPIRED: 'PAYMENT_DESTINATION_EXPIRED',
    DECODE: 'PAYMENT_DESTINATION_DECODING_ERROR',
    PROVIDER_UNAVAILABLE: 'PROVIDER_UNAVAILABLE',
    IN_PROGRESS: 'QR_INIT_IN_PROGRESS',
} as const

export type QrInitCode = (typeof QR_INIT_CODE)[keyof typeof QR_INIT_CODE]

const ALL_CODES: readonly QrInitCode[] = Object.values(QR_INIT_CODE)

/**
 * The KYC 400's prose, kept only as a legacy fallback: an API build that
 * predates the `code` field identifies it by this sentence alone.
 */
const LEGACY_KYC_MESSAGE = 'User KYC not approved'

/**
 * The one refusal with no wire code and no prospect of one: Fastify's AJV
 * rejects the request before any handler runs, so there is nothing to attach a
 * code to. Retrying re-sends the same headerless request, so it must still
 * fail fast.
 */
const MISSING_AUTH_MESSAGE = "required property 'authorization'"

/**
 * Deterministic refusals: the verdict cannot change between attempts inside one
 * scan, so the retry budget must not be spent on them. Each retry re-runs
 * `createQrPaymentLock` against Manteca.
 *
 * `amountRetryable` says whether a DIFFERENT AMOUNT can clear it — which is
 * only ever actionable where the user controls the amount. Verified against
 * peanut-api-ts `src/manteca/cap-check.ts`:
 *  - CAP compares `attempted <= available`, so a smaller amount can fit.
 *  - MERCHANT_VOLUME compares `rolling30dTotal + attempted >= LIMIT`, same.
 *  - MERCHANT_REFUND keys off refund age and count and never reads the amount.
 *  - KYC / NOT_PROVISIONED do not care what the user types.
 *  - PIX_MIN_AMOUNT fires when the payment is UNDER the rail floor.
 */
const DETERMINISTIC: Partial<Record<QrInitCode, { amountRetryable: boolean }>> = {
    [QR_INIT_CODE.CAP]: { amountRetryable: true },
    [QR_INIT_CODE.MERCHANT_VOLUME]: { amountRetryable: true },
    [QR_INIT_CODE.MERCHANT_REFUND]: { amountRetryable: false },
    [QR_INIT_CODE.NOT_PROVISIONED]: { amountRetryable: false },
    [QR_INIT_CODE.KYC]: { amountRetryable: false },
    [QR_INIT_CODE.PIX_MIN_AMOUNT]: { amountRetryable: true },
    [QR_INIT_CODE.PIX_RECURRING]: { amountRetryable: false },
    [QR_INIT_CODE.MISSING_AMOUNT]: { amountRetryable: false },
    [QR_INIT_CODE.EXPIRED]: { amountRetryable: false },
    [QR_INIT_CODE.DECODE]: { amountRetryable: false },
}

/**
 * Reads the wire discriminant off an init rejection.
 *
 * Wire code first; the allow-listed message match is the compatibility path for
 * API builds that only populate `error`. Returns undefined for anything not in
 * the table, so an unrelated third-party `.code` can never be mistaken for one
 * of ours.
 */
export function qrInitCode(error: unknown): QrInitCode | undefined {
    const wire = wireErrorCode(error)
    if (wire && (ALL_CODES as readonly string[]).includes(wire)) return wire as QrInitCode

    const message = error instanceof Error ? error.message : ''
    if (!message) return undefined
    if (message.includes(LEGACY_KYC_MESSAGE)) return QR_INIT_CODE.KYC
    return ALL_CODES.find((code) => message.includes(code))
}

/**
 * Single source of truth for the retry gate. A deterministic refusal stops
 * after one POST instead of four, so a capped scan leaves one price lock at
 * Manteca rather than four.
 */
export function isNonRetryableQrInitError(error: unknown): boolean {
    if (error instanceof Error && error.message.includes(MISSING_AUTH_MESSAGE)) return true
    const code = qrInitCode(error)
    return !!code && code in DETERMINISTIC
}

/** Where the refusal was observed. The same code is not equally actionable in both. */
export type QrInitCallSite = 'scan' | 'amount-entry'

export type QrInitRejection = {
    code: QrInitCode
    /**
     * True only when the user can act on it FROM HERE. A cap refused at scan
     * time carries a merchant-encoded amount the user cannot change, so the
     * screen must neither promise a smaller amount nor leave Pay enabled.
     */
    amountRetryable: boolean
}

/**
 * Classifies a deterministic rejection, or null when the failure is not one.
 *
 * `amountRetryable` is deliberately a function of BOTH the code and the call
 * site. At scan time the amount belongs to the merchant's QR — an open-amount
 * QR returns a lock with an empty code and reaches the cap check only once the
 * user submits a number — so no amount-shaped advice applies there.
 */
export function classifyQrInitError(error: unknown, callSite: QrInitCallSite): QrInitRejection | null {
    const code = qrInitCode(error)
    if (!code) return null
    const entry = DETERMINISTIC[code]
    if (!entry) return null
    return { code, amountRetryable: entry.amountRetryable && callSite === 'amount-entry' }
}

/**
 * Everything the scan screen can be showing, derived from the query rather than
 * latched into state.
 *
 * A lock in hand is checked FIRST and unconditionally. That ordering is what
 * makes "recovered scan stuck behind a stale outage message" unrepresentable
 * instead of something each new branch has to remember to clear — the class of
 * defect that produced four separate rounds of fixes here.
 */
export type QrScanOutcome =
    | { kind: 'ready' }
    | { kind: 'pending' }
    | { kind: 'retrying' }
    | { kind: 'awaiting-merchant-amount' }
    | { kind: 'failed'; reason: QrScanFailure }

/** `offline` and `provider-issues` are transport verdicts, not backend codes. */
export type QrScanFailure = QrInitCode | 'offline' | 'auth-missing' | 'provider-issues'

export type QrScanInput = {
    hasLock: boolean
    /** Set only once the query SETTLES — this is what separates an outcome from a pending retry. */
    settledError: Error | null
    /** The FIRST failure, present while retries are still to come. */
    failureReason: Error | null
    fetchStatus: 'fetching' | 'paused' | 'idle'
}

export function classifyScanOutcome(input: QrScanInput): QrScanOutcome {
    // A lock outranks every failure that preceded it.
    if (input.hasLock) return { kind: 'ready' }

    const error = input.settledError ?? input.failureReason
    if (!error) return { kind: 'pending' }

    const code = qrInitCode(error)
    if (code === QR_INIT_CODE.MISSING_AMOUNT) return { kind: 'awaiting-merchant-amount' }
    if (code && code in DETERMINISTIC) return { kind: 'failed', reason: code }
    if (error.message.includes(MISSING_AUTH_MESSAGE)) return { kind: 'failed', reason: 'auth-missing' }

    /*
     * A PAUSED query is a positive signal that the DEVICE lost connectivity —
     * nothing else parks a query under react-query's default networkMode. No
     * fetch is in flight, so no AbortController fires and `settledError` is
     * never set: without this branch the scan would sit on the retry caption
     * with no outcome and no way out.
     */
    if (input.fetchStatus === 'paused') return { kind: 'failed', reason: 'offline' }

    /*
     * Retries still to come. Saying the rail is down here contradicts what the
     * query is still doing — a scan that recovers on attempt 2 would already
     * have told the user MercadoPago was broken.
     */
    if (!input.settledError) return { kind: 'retrying' }

    return { kind: 'failed', reason: 'provider-issues' }
}
