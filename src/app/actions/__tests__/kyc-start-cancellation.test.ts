import { initiateSumsubKyc, getVerificationSession, refreshVerificationSession } from '@/app/actions/sumsub'
import { findKycDocumentPlan, getKycDocumentStatus, resumeKycDocumentAttempt } from '@/app/actions/kyc-workflow'
import { serverFetch } from '@/utils/api-fetch'

jest.mock('@/utils/api-fetch', () => ({ serverFetch: jest.fn() }))
jest.mock('@/utils/sentry-lazy', () => ({ captureException: jest.fn() }))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))

const mockFetch = jest.mocked(serverFetch)
const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body }) as Response

// Optional signal parameters are the accepted public contract. Cast only to
// allow behavioral red tests against the older, shorter TypeScript signatures.
const start = initiateSumsubKyc as (
    params: Parameters<typeof initiateSumsubKyc>[0],
    owner: string | undefined,
    signal: AbortSignal
) => ReturnType<typeof initiateSumsubKyc>
const plan = findKycDocumentPlan as (source: 'initiate', signal: AbortSignal) => ReturnType<typeof findKycDocumentPlan>
const status = getKycDocumentStatus as (signal: AbortSignal) => ReturnType<typeof getKycDocumentStatus>
const resume = resumeKycDocumentAttempt as (
    attemptId: string,
    beforeDispatch: (() => boolean) | undefined,
    signal: AbortSignal
) => ReturnType<typeof resumeKycDocumentAttempt>

beforeEach(() => mockFetch.mockReset())

it('passes initiation cancellation to fetch and prevents delayed prerequisite dispatch', async () => {
    mockFetch.mockResolvedValue(ok({ token: 'token', applicantId: 'applicant', status: 'NOT_STARTED' }))
    const controller = new AbortController()
    await start({ regionIntent: 'EU' }, 'owner', controller.signal)
    const options = mockFetch.mock.calls[0][1]!
    expect(options.signal).toBe(controller.signal)
    expect(options.beforeDispatch?.()).toBe(true)
    controller.abort()
    expect(options.beforeDispatch?.()).toBe(false)
})

it.each(['plan', 'status', 'resume', 'session', 'session token'] as const)(
    'passes %s cancellation to fetch',
    async (stage) => {
        mockFetch.mockResolvedValue(
            ok(
                stage === 'plan'
                    ? { available: false, routes: [] }
                    : stage === 'status'
                      ? { identity: { canonicalStatus: 'PENDING' } }
                      : { attemptId: 'attempt', token: 'token', applicantId: 'applicant', sdkConfig: {}, session: null }
            )
        )
        const controller = new AbortController()
        if (stage === 'plan') await plan('initiate', controller.signal)
        else if (stage === 'status') await status(controller.signal)
        else if (stage === 'resume') await resume('attempt', () => true, controller.signal)
        else if (stage === 'session') await getVerificationSession('session', controller.signal)
        else await refreshVerificationSession({ id: 'session', generation: 3 }, controller.signal)
        const options = mockFetch.mock.calls[0][1]!
        expect(options.signal).toBe(controller.signal)
        expect(options.beforeDispatch?.()).toBe(true)
        controller.abort()
        expect(options.beforeDispatch?.()).toBe(false)
    }
)

it('does not retry a canceled plan read', async () => {
    jest.useFakeTimers()
    try {
        const controller = new AbortController()
        const reason = new Error('stage canceled')
        mockFetch.mockImplementation(async () => {
            controller.abort(reason)
            throw reason
        })
        const outcome = plan('initiate', controller.signal).catch((error: unknown) => error)
        await jest.runAllTimersAsync()
        expect(await outcome).toBe(reason)
        expect(mockFetch).toHaveBeenCalledTimes(1)
    } finally {
        jest.useRealTimers()
    }
})

it.each(['ConnectionTimeoutError', 'MutationResponseTimeoutError', 'TypeError'])(
    'keeps %s uncertain rather than returning an ordinary initiation refusal',
    async (name) => {
        const timeout = Object.assign(new Error('connection failed'), { name })
        mockFetch.mockRejectedValue(timeout)
        await expect(start({ regionIntent: 'EU' }, 'owner', new AbortController().signal)).rejects.toBe(timeout)
    }
)
