/**
 * The classifier both `/manteca/qr-payment/init` call sites share.
 *
 * It exists because the two paths drifted: the scan-time query mapped cap,
 * merchant and KYC rejections to copy that names the real cause, while the
 * post-amount re-init — the ONLY place an open-amount QR can learn its cap
 * verdict, since the scan returns a lock with an empty code — collapsed all of
 * them into "unexpected error". That is the framing
 * product/providers/fiat/README.md records as having blocked a capped user for
 * three days.
 *
 * Tested here rather than through the page because the assertion that matters
 * is the mapping itself, and one function now serves both call sites.
 */
import { deterministicInitErrorMessage, type QrInitCopy } from '../init-error-classifier'

const copy: QrInitCopy = {
    cap: 'CAP_COPY',
    merchant: 'MERCHANT_COPY',
    kyc: 'KYC_COPY',
    pixMinAmount: 'PIX_MIN_COPY',
}

const apiError = (message: string, code?: string) =>
    Object.assign(new Error(message), { name: 'ApiError', status: 422, code })

describe('deterministicInitErrorMessage', () => {
    it.each([
        ['MANTECA_SOURCE_OVER_MONTHLY_CAP', 'CAP_COPY'],
        ['MANTECA_MERCHANT_VOLUME_NEAR_CAP', 'MERCHANT_COPY'],
        ['MANTECA_MERCHANT_RECENT_REFUND', 'MERCHANT_COPY'],
        ['MANTECA_USER_NOT_PROVISIONED', 'KYC_COPY'],
        ['User KYC not approved', 'KYC_COPY'],
        ['PIX_MIN_AMOUNT', 'PIX_MIN_COPY'],
    ])('maps %s to its own copy', (message, expected) => {
        expect(deterministicInitErrorMessage(new Error(message), copy)?.message).toBe(expected)
    })

    /*
     * Only the amount-shaped rejections invite another try. Getting this wrong
     * either dead-ends a capped user (the copy says "try a smaller amount"
     * while Pay stays disabled) or leaves Pay live for a KYC block no amount
     * can clear.
     */
    it.each([
        ['MANTECA_SOURCE_OVER_MONTHLY_CAP', true],
        ['PIX_MIN_AMOUNT', true],
        // Same copy, different retryability: the volume cap compares
        // rolling30dTotal + attempted, so a smaller amount can fit; the refund
        // block keys off refund age and count and ignores the amount.
        ['MANTECA_MERCHANT_VOLUME_NEAR_CAP', true],
        ['MANTECA_MERCHANT_RECENT_REFUND', false],
        ['MANTECA_USER_NOT_PROVISIONED', false],
        ['User KYC not approved', false],
    ])('marks %s amountRetryable=%s', (message, retryable) => {
        expect(deterministicInitErrorMessage(new Error(message), copy)?.amountRetryable).toBe(retryable)
    })

    // The KYC rejection's stable discriminant is its code; the prose is a
    // sentence the backend can reword at any time.
    it('reads the KYC wire code even when the prose has changed', () => {
        expect(deterministicInitErrorMessage(apiError('totally reworded', 'MANTECA_KYC_REQUIRED'), copy)?.message).toBe(
            'KYC_COPY'
        )
    })

    /*
     * Null is what lets each caller keep its own handling: the scan path still
     * owns decode/expiry/recurring and the retry state machine, the re-init
     * path still owns its Sentry capture. A blanket mapping here would swallow
     * a genuine network failure into a cap message.
     */
    it.each([['Failed to fetch'], ['PAYMENT_DESTINATION_DECODING_ERROR'], ['Network timeout'], ['']])(
        'returns null for %s so the caller owns it',
        (message) => {
            expect(deterministicInitErrorMessage(new Error(message), copy)).toBeNull()
        }
    )

    it('returns null for a non-Error throw rather than crashing the catch', () => {
        expect(deterministicInitErrorMessage('a string', copy)).toBeNull()
        expect(deterministicInitErrorMessage(undefined, copy)).toBeNull()
    })
})
