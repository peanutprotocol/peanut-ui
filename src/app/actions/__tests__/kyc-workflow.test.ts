import { resumeKycDocumentAttempt, saveKycFeatures } from '@/app/actions/kyc-workflow'
import { serverFetch } from '@/utils/api-fetch'

jest.mock('@/utils/api-fetch', () => ({ serverFetch: jest.fn() }))
const mockFetch = serverFetch as jest.MockedFunction<typeof serverFetch>

const session = {
    attemptId: 'attempt-1',
    token: 'token-1',
    applicantId: 'applicant-1',
    sdkConfig: {
        documentDefinitions: { IDENTITY: { country: 'PRT', idDocType: 'PASSPORT' } },
        autoSelectDocumentDefinitions: true,
    },
}
const notJson = (status: number) =>
    ({
        ok: status >= 200 && status < 300,
        status,
        json: async () => JSON.parse('<html>Bad Gateway</html>'),
    }) as unknown as Response

beforeEach(() => mockFetch.mockReset())

describe('resumeKycDocumentAttempt', () => {
    it('returns the refreshed session', async () => {
        mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => session } as unknown as Response)
        await expect(resumeKycDocumentAttempt('attempt-1')).resolves.toEqual(session)
        expect(mockFetch).toHaveBeenCalledWith('/users/kyc/attempts/attempt-1/token', expect.anything())
    })

    it('a non-JSON gateway error fails as a KYC request failure, not a parser error', async () => {
        mockFetch.mockResolvedValue(notJson(502))
        await expect(resumeKycDocumentAttempt('attempt-1')).rejects.toThrow('KYC request failed')
    })

    it('a non-JSON success fails as an invalid session, not a parser or null-access error', async () => {
        mockFetch.mockResolvedValue(notJson(200))
        await expect(resumeKycDocumentAttempt('attempt-1')).rejects.toThrow('Invalid KYC verification session')
    })
})

describe('saveKycFeatures', () => {
    const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body }) as unknown as Response
    const features = { qr: true, bank: true, local: false, card: false }
    const plan = { available: false, routes: [], policyVersion: 'v1', features }

    it('returns what the save reported for each feature alongside the refreshed plan', async () => {
        const reported = {
            qr: { state: 'on' },
            bank: { state: 'action_required', action: 'supplement:bridge' },
            local: { state: 'not_requested' },
            card: { state: 'not_requested' },
        }
        mockFetch
            .mockResolvedValueOnce(ok({ intents: features, setAt: '2026-10-12T00:00:00.000Z', features: reported }))
            .mockResolvedValueOnce(ok(plan))

        await expect(saveKycFeatures(features)).resolves.toEqual({ plan, features: reported })
        expect(mockFetch).toHaveBeenNthCalledWith(
            1,
            '/users/kyc-intents',
            expect.objectContaining({ method: 'PUT', body: JSON.stringify(features) })
        )
        expect(mockFetch).toHaveBeenNthCalledWith(2, '/users/kyc/plan', expect.anything())
    })

    it('an API that reports no features still returns the plan', async () => {
        mockFetch
            .mockResolvedValueOnce(ok({ intents: features, setAt: '2026-10-12T00:00:00.000Z' }))
            .mockResolvedValueOnce(ok(plan))

        await expect(saveKycFeatures(features, true)).resolves.toEqual({ plan, features: undefined })
        expect(mockFetch).toHaveBeenNthCalledWith(2, '/users/kyc/plan?restart=true', expect.anything())
    })
})
