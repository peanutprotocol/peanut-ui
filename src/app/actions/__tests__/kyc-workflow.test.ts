import { resumeKycDocumentAttempt } from '@/app/actions/kyc-workflow'
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
