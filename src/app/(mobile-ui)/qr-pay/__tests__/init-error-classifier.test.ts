/**
 * The one table both `/manteca/qr-payment/init` call sites share.
 *
 * It exists because the same rejection used to be described in three places
 * that could drift — a prose substring list for the retry gate, a separate wire
 * code list for the KYC case, and a copy mapping keyed on neither. A code added
 * to one and not the others produced a deterministic refusal that still burned
 * four POSTs (and left three orphaned Manteca price locks), or actionable copy
 * the retry gate never let the user see.
 */
import {
    classifyQrInitError,
    classifyScanOutcome,
    isNonRetryableQrInitError,
    qrInitCode,
    QR_INIT_CODE,
    type QrScanInput,
} from '../init-error-classifier'

/** The shape `mantecaApi.initiateQrPayment` throws: message from `error`, plus `code`. */
const apiError = (message: string, code?: string) =>
    Object.assign(new Error(message), { name: 'ApiError', status: 422, code })

const scan = (over: Partial<QrScanInput> = {}): QrScanInput => ({
    hasLock: false,
    settledError: null,
    failureReason: null,
    fetchStatus: 'idle',
    ...over,
})

describe('qrInitCode', () => {
    it('reads the wire code even when the prose has been reworded', () => {
        expect(qrInitCode(apiError('some entirely new sentence', 'MANTECA_KYC_REQUIRED'))).toBe(QR_INIT_CODE.KYC)
    })

    it('falls back to the legacy shape, where the code arrives in the message', () => {
        // Older API builds put the code in `error`, which the service copies to `message`.
        expect(qrInitCode(apiError('MANTECA_SOURCE_OVER_MONTHLY_CAP'))).toBe(QR_INIT_CODE.CAP)
        expect(qrInitCode(apiError('User KYC not approved'))).toBe(QR_INIT_CODE.KYC)
    })

    it('ignores a third-party code that is not ours', () => {
        // ethers/EIP-1193 errors carry unrelated `.code` values; treating one as
        // a QR verdict would fail a payment fast for the wrong reason.
        expect(qrInitCode(apiError('network hiccup', 'NETWORK_ERROR'))).toBeUndefined()
        expect(qrInitCode(new Error('Request timed out'))).toBeUndefined()
        expect(qrInitCode(undefined)).toBeUndefined()
    })
})

describe('isNonRetryableQrInitError', () => {
    const deterministic = [
        QR_INIT_CODE.CAP,
        QR_INIT_CODE.MERCHANT_VOLUME,
        QR_INIT_CODE.MERCHANT_REFUND,
        QR_INIT_CODE.NOT_PROVISIONED,
        QR_INIT_CODE.KYC,
        QR_INIT_CODE.PIX_MIN_AMOUNT,
        QR_INIT_CODE.PIX_RECURRING,
        QR_INIT_CODE.MISSING_AMOUNT,
        QR_INIT_CODE.EXPIRED,
        QR_INIT_CODE.DECODE,
    ]

    it.each(deterministic)('fails fast on %s, by wire code and by legacy prose', (code) => {
        // Each retry re-runs createQrPaymentLock against Manteca, so a refusal
        // the first response already decided must not cost four price locks.
        expect(isNonRetryableQrInitError(apiError('reworded', code))).toBe(true)
        expect(isNonRetryableQrInitError(apiError(code))).toBe(true)
    })

    it('still retries the genuinely transient refusals', () => {
        // A provider blip and an in-flight duplicate are both worth another attempt —
        // and the 409 in particular PROVES no second lock was created.
        expect(isNonRetryableQrInitError(apiError('down', QR_INIT_CODE.PROVIDER_UNAVAILABLE))).toBe(false)
        expect(isNonRetryableQrInitError(apiError('busy', QR_INIT_CODE.IN_PROGRESS))).toBe(false)
        expect(isNonRetryableQrInitError(new Error('Request timed out'))).toBe(false)
    })

    it('fails fast on the missing-auth AJV rejection, which can never carry a code', () => {
        expect(isNonRetryableQrInitError(new Error("body must have required property 'authorization'"))).toBe(true)
    })
})

describe('classifyQrInitError — actionability depends on the call site', () => {
    it('offers a smaller amount only where the user can type one', () => {
        // At scan time the amount is the merchant's: an open-amount QR returns a
        // lock with an empty code and only reaches the cap check once a number
        // is submitted. Promising "try a smaller amount" on a screen with no
        // input — and no way to change the merchant's charge — is the same
        // unactionable-advice failure the rest of this screen exists to remove.
        expect(classifyQrInitError(apiError('x', QR_INIT_CODE.CAP), 'scan')).toEqual({
            code: QR_INIT_CODE.CAP,
            amountRetryable: false,
        })
        expect(classifyQrInitError(apiError('x', QR_INIT_CODE.CAP), 'amount-entry')).toEqual({
            code: QR_INIT_CODE.CAP,
            amountRetryable: true,
        })
    })

    it('treats the two merchant blocks differently, per the backend’s own maths', () => {
        // cap-check.ts: VOLUME compares `rolling30dTotal + attempted >= LIMIT`,
        // so a smaller amount can fit; REFUND keys off refund age/count and
        // never reads the amount.
        expect(classifyQrInitError(apiError('x', QR_INIT_CODE.MERCHANT_VOLUME), 'amount-entry')?.amountRetryable).toBe(
            true
        )
        expect(classifyQrInitError(apiError('x', QR_INIT_CODE.MERCHANT_REFUND), 'amount-entry')?.amountRetryable).toBe(
            false
        )
    })

    it('never marks an identity block amount-retryable', () => {
        for (const code of [QR_INIT_CODE.KYC, QR_INIT_CODE.NOT_PROVISIONED]) {
            expect(classifyQrInitError(apiError('x', code), 'amount-entry')?.amountRetryable).toBe(false)
        }
    })

    it('returns null for anything it does not own, so each caller keeps its own handling', () => {
        expect(classifyQrInitError(new Error('Request timed out'), 'scan')).toBeNull()
        expect(classifyQrInitError(apiError('down', QR_INIT_CODE.PROVIDER_UNAVAILABLE), 'scan')).toBeNull()
    })
})

describe('classifyScanOutcome', () => {
    it('a lock in hand outranks any earlier failure', () => {
        // The latch class, made unrepresentable: a scan that recovers on
        // reconnect must not stay hidden behind the outage message it showed
        // while it was failing.
        expect(
            classifyScanOutcome(
                scan({ hasLock: true, settledError: new Error('Request timed out'), fetchStatus: 'paused' })
            )
        ).toEqual({ kind: 'ready' })
    })

    it('holds the retry caption while attempts remain', () => {
        // failureReason is the FIRST failure, with three attempts still to come.
        expect(classifyScanOutcome(scan({ failureReason: new Error('Request timed out') }))).toEqual({
            kind: 'retrying',
        })
    })

    it('blames the rail only once the retries are actually spent', () => {
        const timeout = new Error('Request timed out')
        expect(classifyScanOutcome(scan({ settledError: timeout, failureReason: timeout }))).toEqual({
            kind: 'failed',
            reason: 'provider-issues',
        })
    })

    it('names the connection, not the rail, when the device went offline', () => {
        // A paused query is the only positive signal that the DEVICE dropped;
        // no fetch is in flight, so settledError never arrives and without this
        // the scan would sit on the caption forever.
        expect(
            classifyScanOutcome(scan({ failureReason: new Error('Request timed out'), fetchStatus: 'paused' }))
        ).toEqual({ kind: 'failed', reason: 'offline' })
    })

    it('acts on a deterministic refusal immediately, without waiting out the retries', () => {
        expect(classifyScanOutcome(scan({ failureReason: apiError('x', QR_INIT_CODE.CAP) }))).toEqual({
            kind: 'failed',
            reason: QR_INIT_CODE.CAP,
        })
    })

    it('routes a missing merchant amount to its own waiting state, not an error', () => {
        expect(classifyScanOutcome(scan({ failureReason: apiError('x', QR_INIT_CODE.MISSING_AMOUNT) }))).toEqual({
            kind: 'awaiting-merchant-amount',
        })
    })

    it('is pending until something happens', () => {
        expect(classifyScanOutcome(scan())).toEqual({ kind: 'pending' })
    })
})
