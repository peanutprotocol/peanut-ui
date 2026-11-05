import { ApiError } from '@/services/api-error'
import { classifyQrInitError, classifyScanOutcome, isNonRetryableQrInitError } from './init-error-classifier'

const codes = ['PAYER_BLOCKED', 'MERCHANT_BLOCKED', 'PIX_RESIDENCE_NOT_SUPPORTED'] as const

describe('first QR payment terminal error acceptance', () => {
    for (const code of codes) {
        const shapes = [
            ['wire code', () => new ApiError('A localized safe message', { status: 422, code })],
            ['legacy exact message', () => new Error(code)],
            ['legacy token in message', () => new Error(`QR init refused: ${code}`)],
        ] as const
        for (const [shape, makeError] of shapes) {
            it(`${code} ${shape} stops automatic and amount retries`, () => {
                const error = makeError()
                expect(isNonRetryableQrInitError(error)).toBe(true)
                for (const phase of ['scan', 'amount-entry'] as const) {
                    expect(classifyQrInitError(error, phase)).toMatchObject({ code, amountRetryable: false })
                }
                expect(
                    classifyScanOutcome({
                        hasLock: false,
                        settledError: error,
                        failureReason: null,
                        fetchStatus: 'idle',
                    })
                ).toMatchObject({ kind: 'failed', reason: code })
            })
            it(`${code} ${shape} cannot override a recovered lock`, () => {
                const outcome = classifyScanOutcome({
                    hasLock: true,
                    settledError: makeError(),
                    failureReason: null,
                    fetchStatus: 'idle',
                })
                expect(outcome.kind).not.toBe('failed')
            })
        }
    }
    it('prefers a stable wire code over a conflicting legacy token', () => {
        const error = new ApiError('PAYER_BLOCKED', { status: 422, code: 'MERCHANT_BLOCKED' })
        expect(classifyQrInitError(error, 'scan')).toMatchObject({ code: 'MERCHANT_BLOCKED', amountRetryable: false })
    })
    it.each(['NOT_PAYER_BLOCKED', 'MERCHANT_BLOCKED_UNKNOWN', 'xPIX_RESIDENCE_NOT_SUPPORTEDx'])(
        'does not treat partial legacy token %j as a known terminal refusal',
        (message) => expect(classifyQrInitError(new Error(message), 'scan')).toBeNull()
    )
})
