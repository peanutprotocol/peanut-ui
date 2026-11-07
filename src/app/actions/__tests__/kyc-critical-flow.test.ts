import { activateKycFeature } from '@/app/actions/kyc-feature-activation'
import { serverFetch } from '@/utils/api-fetch'
import { captureException } from '@/utils/sentry-lazy'

jest.mock('@/utils/api-fetch', () => ({ serverFetch: jest.fn() }))
jest.mock('@/utils/sentry-lazy', () => ({ captureException: jest.fn() }))

const mockServerFetch = jest.mocked(serverFetch)
const mockCaptureException = jest.mocked(captureException)

function response(status: number, body: unknown) {
    return {
        status,
        ok: status >= 200 && status < 300,
        json: async () => body,
    } as never
}

describe('activateKycFeature KYC critical-flow reporting', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('reports a network failure once and preserves the failed result', async () => {
        const error = new TypeError('Failed to fetch')
        mockServerFetch.mockRejectedValueOnce(error)

        await expect(activateKycFeature('card')).resolves.toEqual({ kind: 'failed' })
        expect(mockCaptureException).toHaveBeenCalledTimes(1)
        expect(mockCaptureException).toHaveBeenCalledWith(
            error,
            expect.objectContaining({
                tags: expect.objectContaining({
                    critical_flow: 'kyc',
                    kyc_step: 'feature_activation',
                }),
            })
        )
    })

    it.each(['identity_not_approved', 'feature_not_open', 'questions_missing'] as const)(
        'keeps handled %s conflicts quiet',
        async (code) => {
            mockServerFetch.mockResolvedValueOnce(response(409, { code }))

            await expect(activateKycFeature('card')).resolves.toEqual(
                expect.objectContaining({ kind: 'conflict', code })
            )
            expect(mockCaptureException).not.toHaveBeenCalled()
        }
    )

    it('keeps rate limiting quiet and preserves the failed result', async () => {
        mockServerFetch.mockResolvedValueOnce(response(429, { code: 'rate_limited' }))

        await expect(activateKycFeature('card')).resolves.toEqual({ kind: 'failed' })
        expect(mockCaptureException).not.toHaveBeenCalled()
    })

    it('keeps rate limiting quiet when its response body cannot be read', async () => {
        mockServerFetch.mockResolvedValueOnce({
            status: 429,
            ok: false,
            json: async () => {
                throw new SyntaxError('Invalid JSON')
            },
        } as never)

        await expect(activateKycFeature('card')).resolves.toEqual({ kind: 'failed' })
        expect(mockCaptureException).not.toHaveBeenCalled()
    })

    it.each([
        ['malformed success response', response(200, { unexpected: true })],
        ['server failure', response(503, { code: 'unavailable' })],
        [
            'unreadable server failure response',
            {
                status: 503,
                ok: false,
                json: async () => {
                    throw new SyntaxError('Invalid JSON')
                },
            } as never,
        ],
    ])('reports %s once and preserves the failed result', async (_name, failedResponse) => {
        mockServerFetch.mockResolvedValueOnce(failedResponse)

        await expect(activateKycFeature('card')).resolves.toEqual({ kind: 'failed' })
        expect(mockCaptureException).toHaveBeenCalledTimes(1)
        expect(mockCaptureException).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
                tags: expect.objectContaining({
                    critical_flow: 'kyc',
                    kyc_step: 'feature_activation',
                }),
            })
        )
    })

    it('does not report a successful activation', async () => {
        mockServerFetch.mockResolvedValueOnce(response(200, { state: 'ready' }))

        await expect(activateKycFeature('card')).resolves.toEqual(
            expect.objectContaining({
                kind: 'report',
                report: expect.objectContaining({ state: 'ready' }),
            })
        )
        expect(mockCaptureException).not.toHaveBeenCalled()
    })
})
