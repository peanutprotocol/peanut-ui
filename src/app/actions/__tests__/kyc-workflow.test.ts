import {
    findKycDocumentPlan,
    KycPlanUnavailableError,
    resumeKycDocumentAttempt,
    startKycDocumentReplacement,
    refreshKycIdentityStatus,
    getKycDocumentStatus,
    findKycSetup,
} from '@/app/actions/kyc-workflow'
import { serverFetch } from '@/utils/api-fetch'
import posthog from 'posthog-js'
import * as Sentry from '@/utils/sentry-lazy'

jest.mock('@/utils/sentry-lazy', () => ({ captureMessage: jest.fn() }))

jest.mock('@/utils/api-fetch', () => ({ serverFetch: jest.fn() }))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))
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

beforeEach(() => {
    mockFetch.mockReset()
    jest.mocked(Sentry.captureMessage).mockClear()
})

// APK #4: Android WebView GETs fail intermittently, and a failed plan read used
// to read as "today's flow", which opened a legacy applicant for a Smart
// Paperwork Verification user and shut them out of it.
describe('findKycDocumentPlan', () => {
    const plan = { available: true, routes: [], flow: 'verify-once', features: {} }
    const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body }) as unknown as Response
    const status = (code: number) => ({ ok: false, status: code, json: async () => ({}) }) as unknown as Response
    const read = async (source?: Parameters<typeof findKycDocumentPlan>[0]) => {
        const result = findKycDocumentPlan(source)
        result.catch(() => {})
        await jest.runAllTimersAsync()
        return result
    }

    beforeEach(() => {
        jest.useFakeTimers()
        jest.mocked(posthog.capture).mockClear()
    })
    afterEach(() => jest.useRealTimers())

    it('retries a failed read and returns the plan', async () => {
        mockFetch
            .mockRejectedValueOnce(new TypeError('Failed to fetch'))
            .mockResolvedValueOnce(status(502))
            .mockResolvedValueOnce(ok(plan))

        await expect(read()).resolves.toEqual(plan)
        expect(mockFetch).toHaveBeenCalledTimes(3)
        expect(posthog.capture).not.toHaveBeenCalled()

        // A domain answer that says no plan preserves the legacy flow.
        mockFetch
            .mockReset()
            .mockResolvedValue({ ok: false, status: 404, json: async () => ({ error: 'No plan' }) } as Response)
        await expect(read()).resolves.toBeNull()
        expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it.each([
        { ok: false, status: 404, json: async () => ({ error: 'Not Found', code: 'route_not_found' }) },
        { ok: false, status: 404, json: async () => ({}) },
        { ok: true, status: 200, json: async () => null },
        { ok: true, status: 200, json: async () => ({ available: true }) },
        {
            ok: true,
            status: 200,
            json: async () => {
                throw new SyntaxError('private response')
            },
        },
    ])('rejects contract faults without retrying on test builds', async (response) => {
        process.env.NEXT_PUBLIC_TEST_BUILD_BRANCH = 'test-kyc'
        try {
            mockFetch.mockResolvedValue(response as Response)
            await expect(read()).rejects.toBeInstanceOf(KycPlanUnavailableError)
            expect(mockFetch).toHaveBeenCalledTimes(1)
            expect(Sentry.captureMessage).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    extra: expect.objectContaining({ route: '/users/kyc/plan' }),
                })
            )
            expect(JSON.stringify(jest.mocked(Sentry.captureMessage).mock.calls)).not.toContain('private response')
        } finally {
            delete process.env.NEXT_PUBLIC_TEST_BUILD_BRANCH
        }
    })

    it('reports a production contract failure while retaining the legacy fallback', async () => {
        mockFetch.mockResolvedValue({
            ok: false,
            status: 404,
            json: async () => ({ code: 'route_not_found' }),
        } as Response)
        await expect(read()).resolves.toBeNull()
        expect(Sentry.captureMessage).toHaveBeenCalled()
        expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it('throws when every try fails, and tracks it once with the tries and the status', async () => {
        mockFetch.mockResolvedValue(status(503))

        await expect(read('home')).rejects.toBeInstanceOf(KycPlanUnavailableError)
        expect(mockFetch).toHaveBeenCalledTimes(3)
        expect(posthog.capture).toHaveBeenCalledTimes(1)
        expect(posthog.capture).toHaveBeenCalledWith('kyc_paperwork_plan_failed', {
            attempts: 3,
            http_status: 503,
            source: 'home',
        })
    })

    it('a request that never got a response reports no status', async () => {
        mockFetch.mockRejectedValue(new TypeError('Failed to fetch'))

        await expect(read('initiate')).rejects.toMatchObject({ attempts: 3, status: undefined })
        expect(posthog.capture).toHaveBeenCalledWith('kyc_paperwork_plan_failed', {
            attempts: 3,
            http_status: null,
            source: 'initiate',
        })
    })
})

describe('refreshKycIdentityStatus', () => {
    it('returns a known status', async () => {
        mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ status: 'APPROVED' }) } as Response)
        await expect(refreshKycIdentityStatus()).resolves.toBe('APPROVED')
    })
    it.each([
        () => Promise.reject(new Error('private applicant token')),
        () => Promise.resolve({ ok: false, status: 404, json: async () => ({ code: 'route_not_found' }) } as Response),
        () =>
            Promise.resolve({
                ok: true,
                status: 200,
                json: async () => ({ unexpected: 'private applicant token' }),
            } as Response),
    ])('returns undefined and reports failures without PII', async (reply) => {
        mockFetch.mockImplementation(reply)
        await expect(refreshKycIdentityStatus()).resolves.toBeUndefined()
        expect(Sentry.captureMessage).toHaveBeenCalled()
        const events = JSON.stringify(jest.mocked(Sentry.captureMessage).mock.calls)
        expect(events).toContain('/users/kyc/identity/refresh')
        expect(events).not.toContain('private applicant token')
    })
})

it.each([{}, { identity: { canonicalStatus: 'UNKNOWN_ENUM' } }, { identity: [] }])(
    'reports malformed profile status: %p',
    async (profile) => {
        mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => profile } as Response)
        await expect(getKycDocumentStatus()).rejects.toThrow('API contract error')
        expect(Sentry.captureMessage).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({
                extra: expect.objectContaining({ route: '/users/kyc/profile' }),
            })
        )
    }
)

it('reports a malformed setup profile before preserving its fallback', async () => {
    mockFetch.mockImplementation(
        async (route) =>
            ({
                ok: true,
                status: 200,
                json: async () =>
                    route === '/users/kyc/profile'
                        ? { identity: { verificationId: 'private-id', canonicalStatus: 'APPROVED' } }
                        : { available: true, routes: [] },
            }) as Response
    )
    await expect(findKycSetup()).resolves.toBeNull()
    expect(Sentry.captureMessage).toHaveBeenCalled()
    expect(JSON.stringify(jest.mocked(Sentry.captureMessage).mock.calls)).not.toContain('private-id')
})

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
