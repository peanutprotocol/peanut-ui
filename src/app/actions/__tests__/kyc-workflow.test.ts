import { resumeKycDocumentAttempt, startKycDocumentReplacement } from '@/app/actions/kyc-workflow'
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

describe('startKycDocumentReplacement', () => {
    const replacement = {
        requestKey: 'key-1',
        policyVersion: 'v1',
        routeId: 'base',
        documents: [{ key: 'identity', type: 'PASSPORT', issuingCountry: 'PT' }],
    }
    const reply = (status: number, body: unknown, headers: Record<string, string> = {}) =>
        ({
            ok: status >= 200 && status < 300,
            status,
            json: async () => body,
            headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
        }) as unknown as Response

    it('sends the chosen documents as the restart replacement and returns its session', async () => {
        mockFetch.mockResolvedValue(
            reply(200, { ...session, levelName: 'base', status: 'COLLECTING', regionIntent: 'EU' })
        )
        await expect(startKycDocumentReplacement(replacement)).resolves.toEqual({
            kind: 'session',
            session: expect.objectContaining({
                attemptId: 'attempt-1',
                token: 'token-1',
                sdkConfig: session.sdkConfig,
            }),
        })
        expect(mockFetch).toHaveBeenCalledWith(
            '/users/identity/restart',
            expect.objectContaining({ method: 'POST', body: JSON.stringify({ replacement }) })
        )
    })

    it('a refusal keeps the API’s own message only when it is written for users', async () => {
        mockFetch.mockResolvedValue(reply(409, { error: 'Replacement document policy changed; reload the list' }))
        await expect(startKycDocumentReplacement(replacement)).resolves.toEqual({
            kind: 'failed',
            error: 'Failed to restart identity verification',
            code: 'restart_failed',
            cooldown: undefined,
        })
        mockFetch.mockResolvedValue(reply(409, { userMessage: 'Your ID is still being checked.' }))
        await expect(startKycDocumentReplacement(replacement)).resolves.toMatchObject({
            kind: 'failed',
            error: 'Your ID is still being checked.',
            code: undefined,
        })
    })

    it('a restart cooldown carries its retry time', async () => {
        mockFetch.mockResolvedValue(reply(429, { error: 'Too many', retryAt: '2026-10-24T10:00:00.000Z' }))
        await expect(startKycDocumentReplacement(replacement)).resolves.toMatchObject({
            kind: 'failed',
            cooldown: { retryAt: '2026-10-24T10:00:00.000Z' },
        })
    })

    it('a restart that answers without the replaced attempt is not a usable session', async () => {
        mockFetch.mockResolvedValue(reply(200, { token: 'legacy', levelName: 'general', applicantId: 'a-1' }))
        await expect(startKycDocumentReplacement(replacement)).resolves.toEqual({
            kind: 'failed',
            code: 'invalid_response',
        })
    })
})
