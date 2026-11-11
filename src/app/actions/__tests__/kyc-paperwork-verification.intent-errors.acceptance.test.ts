import {
    getKycQuestions,
    saveKycAnswers,
    savePaperworkVerificationFeatures,
    skipProofOfAddress,
    startPaperworkVerificationIdentity,
} from '@/app/actions/kyc-paperwork-verification'
import { isKycFlowHandedBack } from '@/app/actions/kyc-flow-hand-back'
import { serverFetch } from '@/utils/api-fetch'

jest.mock('@/utils/api-fetch', () => ({ serverFetch: jest.fn() }))
const mockFetch = serverFetch as jest.MockedFunction<typeof serverFetch>
const mockSentryCaptureException = jest.fn()
const mockSentryCaptureMessage = jest.fn()
jest.mock('@sentry/nextjs', () => ({
    ...jest.requireActual('@sentry/nextjs'),
    captureException: (...args: unknown[]) => mockSentryCaptureException(...args),
    captureMessage: (...args: unknown[]) => mockSentryCaptureMessage(...args),
}))

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
    mockSentryCaptureException.mockReset()
    mockSentryCaptureMessage.mockReset()
})

describe('saveKycAnswers', () => {
    it('PUTs the values of one step with the Smart Paperwork Verification header and no telemetry', async () => {
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
                headers: { 'x-kyc-client': '2' },
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

    it("carries the server's user-facing line with any 409 code", async () => {
        mockFetch.mockResolvedValue(reply(409, { code: 'some_new_code', userMessage: 'Your check already ended.' }))
        await expect(saveKycAnswers('purpose', {})).resolves.toEqual({
            kind: 'conflict',
            code: 'some_new_code',
            message: 'Your check already ended.',
        })
    })

    it('reads an older body that names the code `error`', async () => {
        mockFetch.mockResolvedValue(reply(409, { error: 'identity_submitted' }))
        await expect(saveKycAnswers('purpose', {})).resolves.toEqual({ kind: 'conflict', code: 'identity_submitted' })
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

    it.each([true, false])('accepts a valid available=%s response, including empty steps', async (available) => {
        const body = { available, attemptId: null, residence: null, steps: [], firstUnanswered: null }
        mockFetch.mockResolvedValue(reply(200, body))
        await expect(getKycQuestions()).resolves.toEqual(body)
        expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it.each([
        [
            'invalid JSON',
            {
                json: async () => {
                    throw new SyntaxError('private body text')
                },
            },
        ],
        ['null', { json: async () => null }],
        ['an array', { json: async () => [] }],
        ['missing boolean availability', { json: async () => ({ steps: [] }) }],
        ['non-boolean availability', { json: async () => ({ available: 'yes', steps: [] }) }],
        ['non-array steps', { json: async () => ({ available: true, steps: 'private answer' }) }],
    ])('retries one HTTP-success malformed payload (%s), then returns valid questions', async (_label, malformed) => {
        mockFetch.mockResolvedValueOnce({ ok: true, status: 200, ...malformed } as unknown as Response)
        const body = { available: true, attemptId: null, residence: null, steps: [], firstUnanswered: null }
        mockFetch.mockResolvedValueOnce(reply(200, body))
        await expect(getKycQuestions()).resolves.toEqual(body)
        expect(mockFetch).toHaveBeenCalledTimes(2)
        for (const [, options] of mockFetch.mock.calls)
            expect(options).toEqual(expect.objectContaining({ redactTelemetry: true }))
        expect(JSON.stringify(mockFetch.mock.calls)).not.toContain('private body text')
        expect(JSON.stringify(mockFetch.mock.calls)).not.toContain('private answer')
    })

    it('exhausts exactly one retry, rejects with the stable unavailable error, and can be explicitly retried later', async () => {
        mockFetch.mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ available: true, steps: null }),
        } as unknown as Response)
        await expect(getKycQuestions()).rejects.toEqual(new Error('KYC questions unavailable'))
        expect(mockFetch).toHaveBeenCalledTimes(2)
        const valid = { available: false, attemptId: null, residence: null, steps: [], firstUnanswered: null }
        mockFetch.mockResolvedValue(reply(200, valid))
        await expect(getKycQuestions()).resolves.toEqual(valid)
        expect(mockFetch).toHaveBeenCalledTimes(3)
    })

    it.each([
        ['non-success HTTP', () => mockFetch.mockResolvedValue(reply(503, null))],
        [
            'existing-verification hand-back',
            () => mockFetch.mockResolvedValue(reply(409, { code: 'existing_verification' })),
        ],
        ['other 409', () => mockFetch.mockResolvedValue(reply(409, { code: 'feature_not_selected' }))],
        ['transport failure', () => mockFetch.mockRejectedValue(new Error('offline'))],
    ])('does not retry %s', async (_label, arrange) => {
        arrange()
        await expect(getKycQuestions()).rejects.toThrow()
        expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it('exports only bounded diagnostic labels and ignores exporter failure on recovery and exhaustion', async () => {
        const secrets = [
            'questionBodySentinel',
            'privateApplicantIdSentinel',
            'privateNameSentinel',
            'privateAddressSentinel',
            'privateAnswerSentinel',
            'privateTokenSentinel',
            'arbitraryResponseKeySentinel',
            'privateHeaderValueSentinel',
            'privateMimeParameterSentinel',
        ]
        const malformed = {
            ok: true,
            status: 200,
            headers: {
                get: (name: string) =>
                    name.toLowerCase() === 'content-type'
                        ? 'application/json; charset=privateMimeParameterSentinel'
                        : 'privateHeaderValueSentinel',
            },
            json: async () => ({
                available: 'privateNameSentinel',
                steps: [],
                applicantId: 'privateApplicantIdSentinel',
                address: 'privateAddressSentinel',
                answer: 'privateAnswerSentinel',
                token: 'privateTokenSentinel',
                arbitraryResponseKeySentinel: 'questionBodySentinel',
            }),
        } as unknown as Response
        const valid = { available: true, attemptId: null, residence: null, steps: [], firstUnanswered: null }
        mockSentryCaptureException.mockImplementation(() => {
            throw new Error('Sentry unavailable')
        })
        mockSentryCaptureMessage.mockImplementation(() => {
            throw new Error('Sentry unavailable')
        })
        mockFetch.mockResolvedValueOnce(malformed).mockResolvedValueOnce(reply(200, valid))
        await expect(getKycQuestions()).resolves.toEqual(valid)
        expect(mockFetch).toHaveBeenCalledTimes(2)

        const exported = JSON.stringify([
            ...mockSentryCaptureException.mock.calls,
            ...mockSentryCaptureMessage.mock.calls,
        ])
        expect(
            mockSentryCaptureException.mock.calls.length + mockSentryCaptureMessage.mock.calls.length
        ).toBeGreaterThan(0)
        for (const secret of secrets) expect(exported).not.toContain(secret)
        expect(exported).toContain('200')
        expect(exported).toMatch(/json/i)
        expect(exported).toContain('string')
        expect(exported).toContain('array')
        expect(exported).not.toContain('charset')

        mockFetch.mockReset()
        mockFetch.mockResolvedValue(malformed)
        await expect(getKycQuestions()).rejects.toEqual(new Error('KYC questions unavailable'))
        expect(mockFetch).toHaveBeenCalledTimes(2)
    })
})

describe('startPaperworkVerificationIdentity', () => {
    const document = { type: 'PASSPORT', issuingCountry: 'US' }

    it('mints the token with the picked document', async () => {
        mockFetch.mockResolvedValue(reply(200, session))
        await expect(startPaperworkVerificationIdentity('attempt-1', document)).resolves.toEqual({
            kind: 'session',
            session,
        })
        expect(mockFetch).toHaveBeenCalledWith(
            '/users/kyc/attempts/attempt-1/token',
            expect.objectContaining({ method: 'POST', body: JSON.stringify({ document }) })
        )
    })

    it('names the step still missing', async () => {
        mockFetch.mockResolvedValue(reply(409, { code: 'questions_missing', step: 'phone' }))
        await expect(startPaperworkVerificationIdentity('attempt-1', document)).resolves.toEqual({
            kind: 'questions-missing',
            step: 'phone',
        })
    })

    it.each([
        ['document_required', { kind: 'document-required' }],
        ['document_not_allowed', { kind: 'document-not-allowed' }],
        ['verification_complete', { kind: 'complete' }],
        ['identity_submitted', { kind: 'complete' }],
        ['something_new', { kind: 'failed' }],
    ])('maps a 409 %s, old body or new', async (code, outcome) => {
        mockFetch.mockResolvedValue(reply(409, { error: code }))
        await expect(startPaperworkVerificationIdentity('attempt-1', document)).resolves.toEqual(outcome)
        mockFetch.mockResolvedValue(reply(409, { code, userMessage: 'Pick another document.' }))
        await expect(startPaperworkVerificationIdentity('attempt-1', document)).resolves.toEqual({
            ...outcome,
            message: 'Pick another document.',
        })
    })

    it('ignores an empty user-facing line', async () => {
        mockFetch.mockResolvedValue(reply(409, { code: 'document_not_allowed', userMessage: '  ' }))
        await expect(startPaperworkVerificationIdentity('attempt-1', document)).resolves.toEqual({
            kind: 'document-not-allowed',
        })
    })

    it('an invalid session or an error fails', async () => {
        mockFetch.mockResolvedValue(reply(200, { token: 'only' }))
        await expect(startPaperworkVerificationIdentity('attempt-1', document)).resolves.toEqual({ kind: 'failed' })
        mockFetch.mockResolvedValue(reply(503, null))
        await expect(startPaperworkVerificationIdentity('attempt-1', document)).resolves.toEqual({ kind: 'failed' })
    })
})

describe('savePaperworkVerificationFeatures', () => {
    const features = { qr: true, bank: true, local: false, card: true }

    it('reports a newly picked ready feature as available without claiming setup has started', async () => {
        mockFetch.mockResolvedValue(reply(200, { features: { bank: { state: 'ready' } } }))
        await expect(savePaperworkVerificationFeatures(features, { ...features, bank: false })).resolves.toEqual({
            kind: 'ready',
        })
    })

    it('does not report an unchanged feature refusal as the outcome of the newly added bank feature', async () => {
        mockFetch.mockResolvedValue(
            reply(200, {
                features: {
                    bank: { state: 'setting_up' },
                    card: { state: 'refused', reason: 'identity_document_insufficient' },
                },
            })
        )
        await expect(savePaperworkVerificationFeatures(features, { ...features, bank: false })).resolves.toEqual({
            kind: 'saved',
        })
    })

    it('a card owing only its application goes to the card application, not a refusal', async () => {
        mockFetch.mockResolvedValue(
            reply(200, { features: { bank: { state: 'on' }, card: { state: 'action_required' } } })
        )
        await expect(savePaperworkVerificationFeatures(features, { ...features, card: false })).resolves.toEqual({
            kind: 'card-application',
        })
    })

    it('another feature owing an action it cannot start is still refused', async () => {
        mockFetch.mockResolvedValue(
            reply(200, { features: { bank: { state: 'action_required' }, card: { state: 'on' } } })
        )
        await expect(savePaperworkVerificationFeatures(features, { ...features, bank: false })).resolves.toEqual({
            kind: 'refused',
            feature: 'bank',
            copy: 'supplement.unavailable',
        })
    })

    it('PUTs the feature set with the Smart Paperwork Verification header', async () => {
        mockFetch.mockResolvedValue(reply(200, { intents: features }))
        await expect(savePaperworkVerificationFeatures(features)).resolves.toEqual({ kind: 'saved' })
        expect(mockFetch).toHaveBeenCalledWith(
            '/users/kyc-intents',
            expect.objectContaining({ method: 'PUT', headers: { 'x-kyc-client': '2' } })
        )
    })

    it('names the step still missing for the added feature', async () => {
        mockFetch.mockResolvedValue(reply(409, { code: 'questions_missing', feature: 'card', step: 'phone' }))
        await expect(savePaperworkVerificationFeatures(features)).resolves.toEqual({
            kind: 'questions-missing',
            step: 'phone',
        })
    })

    it('anything else fails', async () => {
        mockFetch.mockResolvedValue(reply(500, null))
        await expect(savePaperworkVerificationFeatures(features)).resolves.toEqual({ kind: 'failed' })
        mockFetch.mockRejectedValue(new Error('offline'))
        await expect(savePaperworkVerificationFeatures(features)).resolves.toEqual({ kind: 'failed' })
    })
})

describe('skipProofOfAddress', () => {
    it('POSTs the skip request with the Smart Paperwork Verification header and private no-store fetch options', async () => {
        mockFetch.mockResolvedValue(reply(204, null))
        await expect(skipProofOfAddress()).resolves.toBe('skipped')
        expect(mockFetch).toHaveBeenCalledWith(
            '/users/kyc/proof-of-address/skip',
            expect.objectContaining({
                method: 'POST',
                body: '{}',
                headers: { 'x-kyc-client': '2' },
                cache: 'no-store',
                redactTelemetry: true,
            })
        )
    })

    it('reports a failure for an unsuccessful response', async () => {
        mockFetch.mockResolvedValue(reply(500, null))
        await expect(skipProofOfAddress()).resolves.toBe('failed')
    })

    it('reports a failure for a rejected request', async () => {
        mockFetch.mockRejectedValue(new Error('offline'))
        await expect(skipProofOfAddress()).resolves.toBe('failed')
    })

    it("reports a user the API handed back to today's flow", async () => {
        mockFetch.mockResolvedValue(reply(409, { code: 'existing_verification' }))
        await expect(skipProofOfAddress()).resolves.toBe('handed_back')
    })
})

describe("a user handed back to today's flow", () => {
    it('makes the questions read throw the hand-back error, not the generic one', async () => {
        mockFetch.mockResolvedValue(reply(409, { code: 'existing_verification' }))
        const error = await getKycQuestions().catch((e: unknown) => e)
        expect(isKycFlowHandedBack(error)).toBe(true)
    })

    it('keeps the generic error for any other refusal', async () => {
        mockFetch.mockResolvedValue(reply(409, { code: 'feature_not_selected' }))
        const error = await getKycQuestions().catch((e: unknown) => e)
        expect(isKycFlowHandedBack(error)).toBe(false)
        expect(error).toEqual(new Error('KYC questions unavailable'))
    })
})

describe('identity token hand-back', () => {
    it.each([
        { code: 'existing_verification' },
        {
            code: 'existing_verification',
            userMessage: 'Continue your existing identity verification.',
            error: 'existing_verification',
        },
    ])('maps the existing-verification token conflict to a hand-back: %j', async (body) => {
        mockFetch.mockResolvedValue(reply(409, body))
        await expect(
            startPaperworkVerificationIdentity('attempt-1', { type: 'PASSPORT', issuingCountry: 'US' })
        ).resolves.toMatchObject({ kind: 'handed-back' })
    })
})
