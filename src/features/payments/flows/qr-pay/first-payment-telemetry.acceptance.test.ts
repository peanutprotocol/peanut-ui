import posthog from 'posthog-js'
import { createQrPaymentAttemptTelemetry } from './qr-payment-telemetry'

jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))

const capture = posthog.capture as jest.Mock
const hosts = ['basspago', 'mercadopago', 'other-dynamic', 'static', 'unknown'] as const

describe('privacy bounded Pix outcome telemetry acceptance', () => {
    beforeEach(() => capture.mockReset())

    it.each(hosts)('attaches bounded host %s to every Pix stage', (pixQrHost) => {
        const attempt = createQrPaymentAttemptTelemetry({ qrType: 'PIX', pixQrHost })
        const stages = ['pay_clicked', 'lock_ready', 'request_sent', 'success_committed', 'attempt_finished'] as const
        for (const stage of stages)
            attempt.stage(stage, stage === 'attempt_finished' ? { outcome: 'success' } : undefined)
        expect(capture).toHaveBeenCalledTimes(stages.length)
        for (const stage of stages) {
            expect(capture).toHaveBeenCalledWith(
                'qr_payment_stage',
                expect.objectContaining({
                    schema_version: 1,
                    source: 'client',
                    qr_type: 'PIX',
                    pix_qr_host: pixQrHost,
                    client_payment_attempt_id: attempt.attemptId,
                    stage,
                })
            )
        }
    })

    it.each(['QR3', 'CODI', 'OTHER', undefined] as const)('omits host for non-Pix type %j', (qrType) => {
        createQrPaymentAttemptTelemetry({ qrType, pixQrHost: 'basspago' }).stage('pay_clicked')
        expect(capture).toHaveBeenCalledTimes(1)
        expect(capture.mock.calls[0][1]).not.toHaveProperty('pix_qr_host')
    })

    it.each([undefined, 'https://private.example/key?tax=synthetic123', 'BASSPAGO', ''])(
        'collapses unrecognized runtime host %j to unknown',
        (value) => {
            const context = { qrType: 'PIX', pixQrHost: value } as Parameters<typeof createQrPaymentAttemptTelemetry>[0]
            createQrPaymentAttemptTelemetry(context).stage('pay_clicked')
            expect(capture).toHaveBeenCalledWith(
                'qr_payment_stage',
                expect.objectContaining({ pix_qr_host: 'unknown' })
            )
            if (value) expect(JSON.stringify(capture.mock.calls)).not.toContain(value)
        }
    )

    it.each(['pending', 'unknown'] as const)('preserves %s outcome without recording success or failure', (outcome) => {
        const attempt = createQrPaymentAttemptTelemetry({ qrType: 'PIX', pixQrHost: 'basspago' })
        attempt.stage('request_sent')
        attempt.stage('attempt_finished', { outcome })
        expect(capture).toHaveBeenCalledTimes(2)
        expect(capture.mock.calls[1]).toEqual([
            'qr_payment_stage',
            expect.objectContaining({ stage: 'attempt_finished', outcome }),
        ])
        expect(capture.mock.calls.map((call) => call[1].stage)).not.toContain('success_committed')
        expect(capture.mock.calls.map((call) => call[1].outcome)).not.toContain('success')
        expect(capture.mock.calls.map((call) => call[1].outcome)).not.toContain('failed')
    })

    it('records terminal outcome once and ignores late stages', () => {
        const attempt = createQrPaymentAttemptTelemetry({ qrType: 'PIX', pixQrHost: 'basspago' })
        attempt.stage('attempt_finished', { outcome: 'pending' })
        attempt.stage('attempt_finished', { outcome: 'success' })
        attempt.stage('success_committed')
        expect(capture).toHaveBeenCalledTimes(1)
        expect(capture.mock.calls[0][1]).toMatchObject({ outcome: 'pending' })
    })

    it('does not let a telemetry sink failure throw into payment flow', () => {
        capture.mockImplementation(() => {
            throw new Error('synthetic analytics unavailable')
        })
        const attempt = createQrPaymentAttemptTelemetry({ qrType: 'PIX', pixQrHost: 'basspago' })
        expect(() => attempt.stage('request_sent')).not.toThrow()
        expect(() => attempt.stage('attempt_finished', { outcome: 'unknown' })).not.toThrow()
    })
})
