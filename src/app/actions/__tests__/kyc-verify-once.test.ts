import { getKycQuestions, saveKycAnswers, startVerifyOnceIdentity } from '@/app/actions/kyc-verify-once'
import { serverFetch } from '@/utils/api-fetch'

jest.mock('@/utils/api-fetch', () => ({ serverFetch: jest.fn() }))
const mockVerifyOnceEnabled = jest.fn(() => true)
jest.mock('@/features/verify-once/verifyOnceFlag', () => ({
    verifyOnceHeaders: () => (mockVerifyOnceEnabled() ? { 'x-kyc-verify-once': '1' } : {}),
}))
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
    mockVerifyOnceEnabled.mockReturnValue(true)
})

describe('saveKycAnswers', () => {
    it('PUTs the values of one step with the flag header and no telemetry', async () => {
        mockFetch.mockResolvedValue(reply(200, { next: 'money' }))
        await expect(saveKycAnswers('purpose', { cardPurpose: 'travel' })).resolves.toEqual({
            kind: 'saved',
            next: 'money',
        })
        expect(mockFetch).toHaveBeenCalledWith(
            '/users/kyc/answers/purpose',
            expect.objectContaining({
                method: 'PUT',
                body: JSON.stringify({ values: { cardPurpose: 'travel' } }),
                headers: { 'x-kyc-verify-once': '1' },
                redactTelemetry: true,
                cache: 'no-store',
            })
        )
    })

    it('scopes an add-later save to its feature', async () => {
        mockFetch.mockResolvedValue(reply(200, { next: null }))
        await saveKycAnswers('money', { annualSalary: 'under_25k' }, 'card')
        expect(mockFetch).toHaveBeenCalledWith('/users/kyc/answers/money?feature=card', expect.anything())
    })

    it('sends no flag header while the flag is off', async () => {
        mockVerifyOnceEnabled.mockReturnValue(false)
        mockFetch.mockResolvedValue(reply(200, { next: null }))
        await saveKycAnswers('tax', { taxId: '412-55-0198' })
        expect(mockFetch.mock.calls[0][1]).toEqual(expect.objectContaining({ headers: {} }))
    })

    it('maps 422 to the field errors', async () => {
        mockFetch.mockResolvedValue(reply(422, { errors: { taxId: 'itin_not_accepted' } }))
        await expect(saveKycAnswers('tax', { taxId: '912-70-1234' })).resolves.toEqual({
            kind: 'invalid',
            errors: { taxId: 'itin_not_accepted' },
        })
    })

    it('maps 409 to its conflict code', async () => {
        mockFetch.mockResolvedValue(reply(409, { code: 'feature_not_selected' }))
        await expect(saveKycAnswers('purpose', {})).resolves.toEqual({ kind: 'conflict', code: 'feature_not_selected' })
    })

    it.each([503, 502, 500])('a %i is a retry, never a lost answer', async (status) => {
        mockFetch.mockResolvedValue(reply(status, { code: 'retry' }))
        await expect(saveKycAnswers('purpose', {})).resolves.toEqual({ kind: 'retry' })
    })

    it('an offline or timed-out request is a retry', async () => {
        mockFetch.mockRejectedValue(new Error('ConnectionTimeoutError'))
        await expect(saveKycAnswers('purpose', {})).resolves.toEqual({ kind: 'retry' })
    })
})

describe('getKycQuestions', () => {
    it('reads the feature-scoped questions', async () => {
        const questions = { available: true, attemptId: null, residence: 'US', steps: [], firstUnanswered: null }
        mockFetch.mockResolvedValue(reply(200, questions))
        await expect(getKycQuestions('bank')).resolves.toEqual(questions)
        expect(mockFetch).toHaveBeenCalledWith('/users/kyc/questions?feature=bank', expect.anything())
    })

    it('a failed or malformed read throws', async () => {
        mockFetch.mockResolvedValue(reply(500, null))
        await expect(getKycQuestions()).rejects.toThrow()
        mockFetch.mockResolvedValue(reply(200, { steps: 'nope' }))
        await expect(getKycQuestions()).rejects.toThrow()
    })
})

describe('startVerifyOnceIdentity', () => {
    const document = { type: 'PASSPORT', issuingCountry: 'US' }

    it('mints the token with the picked document', async () => {
        mockFetch.mockResolvedValue(reply(200, session))
        await expect(startVerifyOnceIdentity('attempt-1', document)).resolves.toEqual({ kind: 'session', session })
        expect(mockFetch).toHaveBeenCalledWith(
            '/users/kyc/attempts/attempt-1/token',
            expect.objectContaining({ method: 'POST', body: JSON.stringify({ document }) })
        )
    })

    it('names the step still missing', async () => {
        mockFetch.mockResolvedValue(reply(409, { code: 'questions_missing', step: 'phone' }))
        await expect(startVerifyOnceIdentity('attempt-1', document)).resolves.toEqual({
            kind: 'questions-missing',
            step: 'phone',
        })
    })

    it('an invalid session or an error fails', async () => {
        mockFetch.mockResolvedValue(reply(200, { token: 'only' }))
        await expect(startVerifyOnceIdentity('attempt-1', document)).resolves.toEqual({ kind: 'failed' })
        mockFetch.mockResolvedValue(reply(503, null))
        await expect(startVerifyOnceIdentity('attempt-1', document)).resolves.toEqual({ kind: 'failed' })
    })
})
