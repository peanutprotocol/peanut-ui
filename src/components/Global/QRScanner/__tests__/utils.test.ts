import { captureException } from '@sentry/nextjs'
import { reportQrScanError } from '../utils'

jest.mock('@sentry/nextjs', () => ({ captureException: jest.fn() }))

const mockCaptureException = captureException as jest.MockedFunction<typeof captureException>
const CLAIM_URL = 'https://peanut.me/claim?id=42#p=secret'

beforeEach(() => jest.clearAllMocks())

it.each([
    ['pix', '00020101021226' + '0014br.gov.bcb.pix' + 'x'.repeat(68)],
    ['emv', '000201' + '0014com.mercadolibre' + 'x'.repeat(20)],
    ['url', CLAIM_URL],
    ['other', '0xab5801a7d398351b8be11c439e05c5b3259aec9b'],
])('classifies a payload as %s', (kind, payload) => {
    reportQrScanError(new Error('boom'), payload)
    expect(mockCaptureException.mock.calls[0][1]).toEqual({
        tags: { error_type: 'qr_scan_processing' },
        extra: { qrLength: payload.length, qrKind: kind },
    })
})

it('never ships raw scan content — a claim link secret stays on-device', () => {
    reportQrScanError(new Error('boom'), CLAIM_URL)
    expect(JSON.stringify(mockCaptureException.mock.calls[0][1])).not.toContain('secret')
})
