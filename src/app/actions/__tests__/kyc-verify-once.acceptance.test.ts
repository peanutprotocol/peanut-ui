import { saveKycAnswers, startVerifyOnceIdentity } from '@/app/actions/kyc-verify-once'
import { serverFetch } from '@/utils/api-fetch'

jest.mock('@/utils/api-fetch', () => ({ serverFetch: jest.fn() }))
const mockFetch = serverFetch as jest.MockedFunction<typeof serverFetch>

const reply = (status: number, body: unknown) =>
    ({ ok: status >= 200 && status < 300, status, json: async () => body }) as unknown as Response

const session = {
    attemptId: 'attempt-1',
    token: 'token-1',
    applicantId: 'applicant-1',
    sdkConfig: {
        documentDefinitions: { IDENTITY: { country: 'USA', idDocType: 'PASSPORT' } },
        autoSelectDocumentDefinitions: true,
    },
}

beforeEach(() => {
    mockFetch.mockReset()
})

describe('retry identity token transport acceptance', () => {
    it('reopens the same attempt with an empty JSON body and accepts a base session without sdkConfig', async () => {
        const baseSession = { attemptId: 'attempt-1', token: 'retry-token', applicantId: 'applicant-1' }
        mockFetch.mockResolvedValue(reply(200, baseSession))
        await expect(startVerifyOnceIdentity('attempt-1')).resolves.toEqual({ kind: 'session', session: baseSession })
        expect(mockFetch).toHaveBeenCalledWith(
            '/users/kyc/attempts/attempt-1/token',
            expect.objectContaining({
                method: 'POST',
                body: '{}',
                redactTelemetry: true,
                cache: 'no-store',
            })
        )
    })
    it('distinguishes document-required from a transient token failure', async () => {
        mockFetch.mockResolvedValue(reply(409, { code: 'document_required' }))
        await expect(startVerifyOnceIdentity('attempt-1')).resolves.toEqual({ kind: 'document-required' })
    })
    it('retains the replacement attempt returned by the token endpoint', async () => {
        const replacement = { ...session, attemptId: 'replacement-2' }
        mockFetch.mockResolvedValue(reply(200, replacement))
        await expect(startVerifyOnceIdentity('attempt-1')).resolves.toEqual({ kind: 'session', session: replacement })
    })
})

describe('form protocol failures are not network retries', () => {
    it.each([
        [400, 'invalid_body', 'invalid_body'],
        [400, 'unknown_step', 'unknown_step'],
        [429, 'rate_limited', 'rate_limited'],
    ])('keeps HTTP %i / %s actionable', async (status, wireCode, code) => {
        mockFetch.mockResolvedValue(reply(status, { code: wireCode }))
        await expect(saveKycAnswers('purpose', {})).resolves.toEqual({ kind: 'blocked', code })
    })
})
