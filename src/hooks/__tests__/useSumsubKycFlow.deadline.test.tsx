jest.mock('@/utils/native-platform', () => require('@/test-utils/native-platform-mock').createNativePlatformMock())

import { act } from '@testing-library/react'
import { renderHookWithIntl as renderHook } from '@/test-utils/intl'
import { useSumsubKycFlow } from '@/hooks/useSumsubKycFlow'
import { getKycDocumentPlan } from '@/app/actions/kyc-workflow'
import { initiateSumsubKyc } from '@/app/actions/sumsub'

jest.mock('@/app/actions/kyc-workflow', () => {
    const getKycDocumentPlan = jest.fn()
    return {
        getKycDocumentPlan,
        findKycDocumentPlan: jest.fn(() => getKycDocumentPlan().catch(() => null)),
        getKycDocumentStatus: jest.fn(async () => 'NOT_STARTED'),
        findKycReplacementPlan: jest.fn(async () => null),
        resumeKycDocumentAttempt: jest.fn(),
    }
})
jest.mock('@/app/actions/sumsub', () => ({
    ...jest.requireActual('@/app/actions/sumsub'),
    initiateSumsubKyc: jest.fn(),
    getVerificationSession: jest.fn(async () => null),
}))
jest.mock('@/hooks/useWebSocket', () => ({ useWebSocket: () => {} }))
let mockUserId = 'owner-A'
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ user: { user: { userId: mockUserId, username: mockUserId } } }),
}))
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn(), replace: jest.fn() }) }))
jest.mock('@/utils/capacitor', () => ({ isCapacitor: () => false }))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))

const mockPlan = jest.mocked(getKycDocumentPlan)
const mockInitiate = jest.mocked(initiateSumsubKyc)
const legacyPlan = { available: false, routes: [] }
const started = (token: string) => ({ data: { token, applicantId: 'app-deadline', status: 'NOT_STARTED' as const } })

function deferred<T>() {
    let resolve!: (value: T) => void
    const promise = new Promise<T>((done) => (resolve = done))
    return { promise, resolve }
}

// Exercise the deadline without coupling acceptance to the chosen constant.
const pastDeadline = () => jest.advanceTimersByTimeAsync(60_001)

beforeEach(() => {
    jest.useFakeTimers()
    mockUserId = 'owner-A'
    mockPlan.mockReset().mockResolvedValue(legacyPlan as never)
    mockInitiate.mockReset().mockResolvedValue(started('ready-token'))
})

afterEach(() => {
    jest.clearAllTimers()
    jest.useRealTimers()
})

it('settles a stalled plan read and never dispatches a start after that plan arrives late', async () => {
    const plan = deferred<Awaited<ReturnType<typeof getKycDocumentPlan>>>()
    mockPlan.mockReturnValue(plan.promise)
    const onKycSuccess = jest.fn()
    const { result } = renderHook(() => useSumsubKycFlow({ onKycSuccess }))
    let settled = false

    await act(async () => {
        void result.current.handleInitiateKyc('EU').then(() => (settled = true))
    })
    expect(result.current.isLoading).toBe(true)
    await act(async () => {
        await pastDeadline()
    })

    expect(settled).toBe(true)
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toMatch(/try again/i)
    expect(result.current.isTerminalError).toBe(false)
    expect(result.current.showWrapper).toBe(false)
    expect(mockInitiate).not.toHaveBeenCalled()

    await act(async () => {
        plan.resolve(legacyPlan as never)
        await pastDeadline()
    })

    expect(mockInitiate).not.toHaveBeenCalled()
    expect(result.current.showWrapper).toBe(false)
    expect(result.current.accessToken).toBeFalsy()
    expect(onKycSuccess).not.toHaveBeenCalled()
})

it('reconciles a stalled start before failure and recovers its late SDK token', async () => {
    const start = deferred<Awaited<ReturnType<typeof initiateSumsubKyc>>>()
    mockInitiate.mockReturnValue(start.promise)
    const onKycSuccess = jest.fn()
    const { result } = renderHook(() => useSumsubKycFlow({ onKycSuccess }))
    let settled = false

    await act(async () => {
        void result.current.handleInitiateKyc('EU').then(() => (settled = true))
    })
    expect(mockInitiate).toHaveBeenCalledTimes(1)
    expect(result.current.isLoading).toBe(true)

    await act(async () => {
        await pastDeadline()
    })
    expect(settled).toBe(true)
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toMatch(/try again/i)
    expect(result.current.isTerminalError).toBe(false)
    expect(result.current.showWrapper).toBe(false)

    await act(async () => {
        start.resolve(started('late-token'))
        await pastDeadline()
    })
    expect(result.current.showWrapper).toBe(true)
    expect(result.current.accessToken).toBe('late-token')
    expect(result.current.error).toBeFalsy()
    expect(onKycSuccess).not.toHaveBeenCalled()
})

it('reconciles a retry after expiry without dispatching a second initiation', async () => {
    const oldStart = deferred<Awaited<ReturnType<typeof initiateSumsubKyc>>>()
    mockInitiate.mockReturnValueOnce(oldStart.promise).mockResolvedValueOnce(started('new-token'))
    const { result } = renderHook(() => useSumsubKycFlow({}))

    await act(async () => {
        void result.current.handleInitiateKyc('EU')
        await pastDeadline()
    })
    expect(result.current.isLoading).toBe(false)
    await act(async () => {
        await result.current.handleInitiateKyc('EU')
    })
    expect(mockInitiate).toHaveBeenCalledTimes(1)
    expect(result.current.showWrapper).toBe(false)
    expect(result.current.accessToken).toBeFalsy()
    expect(result.current.error).toMatch(/try again/i)

    await act(async () => {
        oldStart.resolve(started('old-token'))
    })
    expect(result.current.accessToken).toBe('old-token')
    expect(result.current.showWrapper).toBe(true)
})

it.each(['owner change', 'unmount'] as const)(
    'does not dispatch a start after a stalled plan resolves following %s',
    async (invalidation) => {
        const plan = deferred<Awaited<ReturnType<typeof getKycDocumentPlan>>>()
        mockPlan.mockReturnValue(plan.promise)
        const onKycSuccess = jest.fn()
        const { result, rerender, unmount } = renderHook(() => useSumsubKycFlow({ onKycSuccess }))
        await act(async () => {
            void result.current.handleInitiateKyc('EU')
        })
        act(() => {
            if (invalidation === 'unmount') unmount()
            else {
                mockUserId = 'owner-B'
                rerender()
            }
        })
        if (invalidation === 'owner change') expect(result.current.isLoading).toBe(false)

        await act(async () => {
            plan.resolve(legacyPlan as never)
            await pastDeadline()
        })

        expect(mockInitiate).not.toHaveBeenCalled()
        expect(onKycSuccess).not.toHaveBeenCalled()
        expect(result.current.showWrapper).toBe(false)
        expect(result.current.accessToken).toBeFalsy()
    }
)

it.each([
    ['owner change', 'token'],
    ['owner change', 'approval'],
    ['unmount', 'token'],
    ['unmount', 'approval'],
] as const)('ignores a late %s start completion containing %s', async (invalidation, completion) => {
    const start = deferred<Awaited<ReturnType<typeof initiateSumsubKyc>>>()
    mockInitiate.mockReturnValue(start.promise)
    const onKycSuccess = jest.fn()
    const { result, rerender, unmount } = renderHook(() => useSumsubKycFlow({ onKycSuccess }))
    await act(async () => {
        void result.current.handleInitiateKyc('EU')
    })
    expect(mockInitiate).toHaveBeenCalledTimes(1)
    act(() => {
        if (invalidation === 'unmount') unmount()
        else {
            mockUserId = 'owner-B'
            rerender()
        }
    })
    if (invalidation === 'owner change') expect(result.current.isLoading).toBe(false)

    await act(async () => {
        start.resolve(
            completion === 'token'
                ? started('previous-owner-token')
                : { data: { token: null, applicantId: 'previous-owner', status: 'APPROVED' } }
        )
        await pastDeadline()
    })

    expect(mockInitiate).toHaveBeenCalledTimes(1)
    expect(onKycSuccess).not.toHaveBeenCalled()
    expect(result.current.showWrapper).toBe(false)
    expect(result.current.accessToken).toBeFalsy()
})
