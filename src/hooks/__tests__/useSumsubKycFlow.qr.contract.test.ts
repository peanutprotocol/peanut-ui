import { act } from '@testing-library/react'
import { useSumsubKycFlow } from '@/hooks/useSumsubKycFlow'
import { serverFetch } from '@/utils/api-fetch'
import { renderHookWithIntl as renderHook } from '@/test-utils/intl'
import type { KycDocumentPlan } from '@/app/actions/types/kyc-workflow.types'

jest.mock('@/utils/native-platform', () => require('@/test-utils/native-platform-mock').createNativePlatformMock())
jest.mock('@/utils/api-fetch', () => ({ serverFetch: jest.fn() }))
jest.mock('@/hooks/useWebSocket', () => ({ useWebSocket: () => {} }))
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ user: { user: { userId: mockOwner } }, fetchUser: mockFetchUser }),
}))
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }))

const mockPush = jest.fn()
const mockFetchUser = jest.fn()
const fetch = jest.mocked(serverFetch)
const plan = {
    activeAttemptId: null,
    available: false,
    features: { bank: false, card: false, local: false, qr: true },
    flow: null,
    policyVersion: null,
    routes: [],
} satisfies KycDocumentPlan
const approval = { token: null, applicantId: 'applicant-a', status: 'APPROVED' }
let mockOwner: string
let resolveStart: (response: Response) => void

const response = (status: number, body: unknown, retryAfter?: string) =>
    ({
        status,
        ok: status === 200,
        json: async () => JSON.parse(JSON.stringify(body)),
        headers: { get: (key: string) => (key.toLowerCase() === 'retry-after' ? (retryAfter ?? null) : null) },
    }) as Response

const refusal = (status: number, copy: string) => ({
    code: status === 409 ? 'feature_not_open' : 'feature_setup_unavailable',
    userMessage: copy,
    message: copy,
    error: copy,
})

function mount() {
    const onKycSuccess = jest.fn()
    const view = renderHook(() => useSumsubKycFlow({ onKycSuccess }))
    const tap = () =>
        act(async () => {
            void view.result.current.handleUnlockQr()
        })
    const reply = async (status: number, body: unknown, retryAfter?: string) => {
        await act(async () => resolveStart(response(status, body, retryAfter)))
    }
    return { ...view, tap, reply, onKycSuccess }
}

const advance = async (ms: number) => {
    await act(async () => jest.advanceTimersByTimeAsync(ms))
}
const posts = () => fetch.mock.calls.filter(([, options]) => options?.method === 'POST')
const expectExactQrPosts = (total: number) => {
    expect(posts()).toHaveLength(total)
    for (const [path, options] of posts()) {
        expect(path).toBe('/users/identity')
        expect(JSON.parse(String(options?.body))).toStrictEqual({ feature: 'qr' })
    }
}

beforeEach(() => {
    jest.useFakeTimers()
    jest.clearAllMocks()
    mockOwner = 'a'
    mockFetchUser.mockResolvedValue({
        identityVerification: { status: 'verified' },
        capabilities: { features: { qr: { state: 'ready' } } },
    })
    fetch.mockImplementation(async (path) => {
        if (path === '/users/kyc/plan?feature=qr') return response(200, plan)
        if (path === '/users/identity') return new Promise<Response>((resolve) => (resolveStart = resolve))
        throw new Error('Unexpected request: ' + path)
    })
})
afterEach(() => {
    jest.clearAllTimers()
    jest.useRealTimers()
})

it('reads the QR plan, coalesces concurrent taps and refreshes capabilities on tokenless approval', async () => {
    const { result, reply, onKycSuccess } = mount()
    await act(async () => {
        void result.current.handleUnlockQr()
        void result.current.handleUnlockQr()
        void result.current.handleUnlockQr()
    })
    expect(fetch.mock.calls.map(([path]) => path)).toEqual(['/users/kyc/plan?feature=qr', '/users/identity'])
    expectExactQrPosts(1)
    await reply(200, approval)
    expect(mockFetchUser).toHaveBeenCalledTimes(1)
    expect(result.current.showWrapper).toBe(false)
    expect(result.current.error).toBeNull()
    expect(mockPush).not.toHaveBeenCalled()
    expect(onKycSuccess).not.toHaveBeenCalled()
})

it('surfaces the stored QR refusal and blocks a repeated start', async () => {
    const { result, tap, reply } = mount()
    const copy = 'QR payments are unavailable for this account.'
    await tap()
    await reply(409, refusal(409, copy))
    expect(result.current.error).toBe(copy)
    expect(result.current.isTerminalError).toBe(true)
    expect(result.current.isQrUnlockBlocked).toBe(true)
    await advance(60_000)
    await tap()
    expectExactQrPosts(1)
    expect(mockFetchUser).not.toHaveBeenCalled()
})

it('honors Retry-After and resends the QR request only on an explicit tap', async () => {
    const { result, tap, reply } = mount()
    const copy = 'QR setup is temporarily unavailable.'
    await tap()
    await reply(503, refusal(503, copy), '2')
    expect(result.current.error).toBe(copy)
    expect(result.current.isTerminalError).toBe(false)
    expect(result.current.isQrUnlockBlocked).toBe(true)
    await tap()
    await advance(1999)
    await tap()
    expectExactQrPosts(1)
    await advance(1)
    expect(result.current.isQrUnlockBlocked).toBe(false)
    expectExactQrPosts(1)
    await tap()
    expectExactQrPosts(2)
    await reply(200, approval)
    expect(mockFetchUser).toHaveBeenCalledTimes(1)
})

it('does not resolve a timed-out QR start from base identity approval', async () => {
    const { result, tap, onKycSuccess } = mount()
    await tap()
    await advance(30_000)
    expect(mockFetchUser).toHaveBeenCalledTimes(1)
    expect(result.current.error).toBeTruthy()
    expect(result.current.showWrapper).toBe(false)
    expect(mockPush).not.toHaveBeenCalled()
    expect(onKycSuccess).not.toHaveBeenCalled()
    expectExactQrPosts(1)
})

it.each([200, 409, 503])('ignores a late %s after an account switch', async (status) => {
    const { result, tap, reply, rerender, onKycSuccess } = mount()
    await tap()
    mockOwner = 'b'
    rerender()
    await reply(status, status === 200 ? approval : refusal(status, 'Late response'), status === 503 ? '2' : undefined)
    expect(result.current.error).toBeNull()
    expect(result.current.isQrUnlockBlocked).toBe(false)
    expect(result.current.showWrapper).toBe(false)
    expect(mockFetchUser).not.toHaveBeenCalled()
    expect(mockPush).not.toHaveBeenCalled()
    expect(onKycSuccess).not.toHaveBeenCalled()
})

it.each([409, 503])('clears a settled %s when the account changes', async (status) => {
    const { result, tap, reply, rerender } = mount()
    await tap()
    await reply(status, refusal(status, 'Previous account'), status === 503 ? '2' : undefined)
    expect(result.current.error).toBe('Previous account')
    mockOwner = 'b'
    rerender()
    expect(result.current.error).toBeNull()
    expect(result.current.isTerminalError).toBe(false)
    expect(result.current.isQrUnlockBlocked).toBe(false)
    await tap()
    expectExactQrPosts(2)
})

it.each([
    {
        code: 'feature_reverification_required',
        entry: { attemptId: null, kind: 'reverify_for_feature', feature: 'bank', targetProvider: 'BRIDGE' },
    },
    { code: 'feature_selection_required', feature: 'local' },
])('keeps a QR SDK refresh in scope when an older API replies $code', async (conflict) => {
    const { result, tap, reply } = mount()
    await tap()
    await reply(200, { ...approval, status: 'NOT_STARTED', token: 'qr-sdk-token' })
    expect(result.current.showWrapper).toBe(true)
    const copy = 'Continue verification'
    const refresh = result.current.refreshToken()
    const rejected = expect(refresh).rejects.toThrow(copy)
    await reply(409, { ...conflict, userMessage: copy, message: copy, error: copy })
    await rejected
    expectExactQrPosts(2)
    expect(mockPush).not.toHaveBeenCalled()
    expect(fetch.mock.calls.map(([path]) => path)).toEqual([
        '/users/kyc/plan?feature=qr',
        '/users/identity',
        '/users/identity',
    ])
})
