import { captureException } from '@sentry/nextjs'
import { qrTelemetry, reportQrScanError } from '../utils'

jest.mock('@sentry/nextjs', () => ({ captureException: jest.fn() }))
const mockCaptureException = jest.mocked(captureException)
beforeEach(() => jest.clearAllMocks())

it.each([
    ['pix', '000201010212260014br.gov.bcb.pix' + 'private-bank-value'.repeat(5), '64-255'],
    ['pix', '000201010212260014BR.GOV.BCB.PIX', '1-63'],
    ['emv', '0002010014com.mercadolibreprivate-merchant', '1-63'],
    ['url', 'https://peanut.me/claim?id=42#p=secret', '1-63'],
    ['base64-like', 'cHJpdmF0ZS1wYXltZW50'.repeat(22) + 'AAAA', '256-1023'],
    ['other', 'private-user@example.test', '1-63'],
    ['other', '', 'empty'],
])('reports only finite metadata for %s', (kind, payload, bucket) => {
    reportQrScanError(payload)
    const [error, context] = mockCaptureException.mock.calls[0]
    expect(error).toEqual(new Error('QR scan processing failed'))
    expect(error).not.toHaveProperty('cause')
    expect(context).toEqual({
        tags: { error_type: 'qr_scan_processing' },
        extra: { qrKind: kind, qrLengthBucket: bucket },
    })
    expect(context).not.toHaveProperty('extra.qrPayload')
    if (payload) expect(JSON.stringify(context)).not.toContain(payload)
})

it('coarsens long payloads without retaining identifiers or exact lengths', () => {
    expect(qrTelemetry('sensitive '.repeat(200))).toEqual({ qrKind: 'other', qrLengthBucket: '1024+' })
})
