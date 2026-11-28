jest.mock('@/utils/native-platform', () => require('@/test-utils/native-platform-mock').createNativePlatformMock())

import { act } from '@testing-library/react'
import { renderHookWithIntl as renderHook } from '@/test-utils/intl'
import { useSumsubKycFlow } from '@/hooks/useSumsubKycFlow'
import { findKycDocumentPlan, getKycDocumentStatus, resumeKycDocumentAttempt } from '@/app/actions/kyc-workflow'
import {
    initiateSumsubKyc,
    startKycAction,
    getVerificationSession,
    refreshVerificationSession,
} from '@/app/actions/sumsub'

jest.mock('@/app/actions/kyc-workflow', () => ({
    findKycDocumentPlan: jest.fn(),
    getKycDocumentStatus: jest.fn(),
    findKycReplacementPlan: jest.fn(async () => null),
    resumeKycDocumentAttempt: jest.fn(),
}))
jest.mock('@/app/actions/sumsub', () => ({
    ...jest.requireActual('@/app/actions/sumsub'),
    initiateSumsubKyc: jest.fn(),
    getVerificationSession: jest.fn(async () => null),
    startKycAction: jest.fn(),
    refreshVerificationSession: jest.fn(),
}))
jest.mock('@/hooks/useWebSocket', () => ({ useWebSocket: () => {} }))
let mockUserId = 'owner-A'
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ user: { user: { userId: mockUserId, username: mockUserId } } }),
}))
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn(), replace: jest.fn() }) }))
jest.mock('@/utils/capacitor', () => ({ isCapacitor: () => false }))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))

const mockPlan = jest.mocked(findKycDocumentPlan)
const mockStatus = jest.mocked(getKycDocumentStatus)
const mockResume = jest.mocked(resumeKycDocumentAttempt)
const mockInitiate = jest.mocked(initiateSumsubKyc)
const legacyPlan = { available: false, routes: [] }
const started = (token: string) => ({ data: { token, applicantId: 'app-reconcile', status: 'NOT_STARTED' as const } })
function deferred<T>() {
    let resolve!: (value: T) => void
    const promise = new Promise<T>((done) => (resolve = done))
    return { promise, resolve }
}
const advance = async (milliseconds: number) => {
    await act(async () => {
        await jest.advanceTimersByTimeAsync(milliseconds)
    })
}

beforeEach(() => {
    jest.useFakeTimers()
    mockUserId = 'owner-A'
    mockPlan.mockReset().mockResolvedValue(legacyPlan as never)
    mockStatus.mockReset().mockResolvedValue('NOT_STARTED')
    mockResume.mockReset()
    jest.mocked(getVerificationSession).mockReset().mockResolvedValue(null)
    jest.mocked(startKycAction).mockReset()
    jest.mocked(refreshVerificationSession).mockReset()
    mockInitiate.mockReset().mockResolvedValue(started('ready-token'))
})
afterEach(() => {
    jest.clearAllTimers()
    jest.useRealTimers()
})

it('accepts an arrived initiation response across a wall-clock jump', async () => {
    const start = deferred<Awaited<ReturnType<typeof initiateSumsubKyc>>>()
    mockInitiate.mockReturnValue(start.promise)
    const { result } = renderHook(() => useSumsubKycFlow({}))
    await act(async () => {
        void result.current.handleInitiateKyc('EU')
    })
    expect(mockInitiate).toHaveBeenCalledTimes(1)
    await act(async () => {
        jest.setSystemTime(Date.now() + 120_000)
        start.resolve(started('arrived-token'))
    })
    expect(result.current.accessToken).toBe('arrived-token')
    expect(result.current.showWrapper).toBe(true)
    expect(result.current.error).toBeFalsy()
})

it('gives initiation its own 30 seconds after a 25-second plan read', async () => {
    const plan = deferred<Awaited<ReturnType<typeof findKycDocumentPlan>>>()
    const start = deferred<Awaited<ReturnType<typeof initiateSumsubKyc>>>()
    mockPlan.mockReturnValueOnce(plan.promise)
    mockInitiate.mockReturnValue(start.promise)
    const { result } = renderHook(() => useSumsubKycFlow({}))
    await act(async () => {
        void result.current.handleInitiateKyc('EU')
    })
    await advance(25_000)
    await act(async () => {
        plan.resolve(legacyPlan as never)
    })
    expect(mockInitiate).toHaveBeenCalledTimes(1)
    await advance(25_000)
    expect(result.current.isLoading).toBe(true)
    await act(async () => {
        start.resolve(started('separate-budget-token'))
    })
    expect(result.current.accessToken).toBe('separate-budget-token')
    expect(result.current.error).toBeFalsy()
})

it('aborts the initiation signal at its stage bound', async () => {
    mockInitiate.mockReturnValue(new Promise(() => {}))
    const { result } = renderHook(() => useSumsubKycFlow({}))
    await act(async () => {
        void result.current.handleInitiateKyc('EU')
    })
    // Optional action argument is the public cancellation contract.
    const signal = (mockInitiate.mock.calls[0] as unknown[])[2] as AbortSignal | undefined
    expect(signal).toBeDefined()
    expect(signal?.aborted).toBe(false)
    await advance(30_001)
    expect(signal?.aborted).toBe(true)
})

it('reads status before publishing uncertain failure and shows pending review', async () => {
    const status = deferred<Awaited<ReturnType<typeof getKycDocumentStatus>>>()
    mockInitiate.mockReturnValue(new Promise(() => {}))
    mockStatus.mockReturnValue(status.promise)
    const { result } = renderHook(() => useSumsubKycFlow({}))
    await act(async () => {
        void result.current.handleInitiateKyc('EU')
    })
    await advance(30_001)
    expect(mockStatus).toHaveBeenCalled()
    expect(result.current.error).toBeFalsy()
    await act(async () => {
        status.resolve('PENDING')
    })
    expect(result.current.isVerificationProgressModalOpen).toBe(true)
    expect(result.current.error).toBeFalsy()
    expect(mockInitiate).toHaveBeenCalledTimes(1)
})

it.each(['NOT_STARTED', 'unknown', 'failed'] as const)(
    'keeps uncertain initiation fenced across repeated taps when reconciliation is %s',
    async (outcome) => {
        mockInitiate.mockReturnValueOnce(new Promise(() => {})).mockResolvedValue(started('duplicate-token'))
        if (outcome === 'unknown') mockStatus.mockResolvedValue(undefined)
        if (outcome === 'failed') mockStatus.mockRejectedValue(new Error('status unavailable'))
        const { result } = renderHook(() => useSumsubKycFlow({}))
        await act(async () => {
            void result.current.handleInitiateKyc('EU')
        })
        await advance(90_001)
        expect(result.current.isLoading).toBe(false)
        const readsAfterTimeout = mockStatus.mock.calls.length
        for (let tap = 0; tap < 3; tap++) {
            await act(async () => {
                void result.current.handleInitiateKyc('EU')
            })
            await advance(90_001)
        }
        expect(mockStatus.mock.calls.length).toBeGreaterThan(readsAfterTimeout)
        expect(mockInitiate).toHaveBeenCalledTimes(1)
        expect(result.current.accessToken).toBeFalsy()
    }
)

it('recovers a late usable original response for the current owner', async () => {
    const start = deferred<Awaited<ReturnType<typeof initiateSumsubKyc>>>()
    mockInitiate.mockReturnValue(start.promise)
    mockStatus.mockResolvedValue(undefined)
    const { result } = renderHook(() => useSumsubKycFlow({}))
    await act(async () => {
        void result.current.handleInitiateKyc('EU')
    })
    await advance(90_001)
    expect(result.current.isLoading).toBe(false)
    await act(async () => {
        start.resolve(started('late-original-token'))
    })
    expect(result.current.accessToken).toBe('late-original-token')
    expect(result.current.showWrapper).toBe(true)
    expect(result.current.error).toBeFalsy()
    expect(mockInitiate).toHaveBeenCalledTimes(1)
})

it.each(['owner change', 'unmount'] as const)('blocks late recovery after %s', async (invalidation) => {
    const start = deferred<Awaited<ReturnType<typeof initiateSumsubKyc>>>()
    mockInitiate.mockReturnValue(start.promise)
    const onKycSuccess = jest.fn()
    const { result, rerender, unmount } = renderHook(() => useSumsubKycFlow({ onKycSuccess }))
    await act(async () => {
        void result.current.handleInitiateKyc('EU')
    })
    await advance(90_001)
    act(() => {
        if (invalidation === 'unmount') unmount()
        else {
            mockUserId = 'owner-B'
            rerender()
        }
    })
    await act(async () => {
        start.resolve(started('stale-owner-token'))
    })
    expect(result.current.accessToken).toBeFalsy()
    expect(result.current.showWrapper).toBe(false)
    expect(onKycSuccess).not.toHaveBeenCalled()
})

it('permits at most one initiation for simultaneous taps', async () => {
    const start = deferred<Awaited<ReturnType<typeof initiateSumsubKyc>>>()
    mockInitiate.mockReturnValue(start.promise)
    const { result } = renderHook(() => useSumsubKycFlow({}))
    await act(async () => {
        for (let tap = 0; tap < 20; tap++) void result.current.handleInitiateKyc('EU')
    })
    expect(mockInitiate).toHaveBeenCalledTimes(1)
    await act(async () => {
        start.resolve(started('single-token'))
    })
    expect(result.current.accessToken).toBe('single-token')
})

it('re-reads the plan and resumes an attempt created by the uncertain initiation', async () => {
    const start = deferred<Awaited<ReturnType<typeof initiateSumsubKyc>>>()
    mockInitiate.mockReturnValue(start.promise)
    mockPlan.mockResolvedValueOnce(legacyPlan as never).mockResolvedValue({
        available: true,
        routes: [],
        activeAttemptId: 'attempt-created',
        flow: 'document-first',
        policyVersion: 'test-policy',
        features: { qr: true, bank: true, card: false, local: false },
    } as never)
    mockResume.mockResolvedValue({
        attemptId: 'attempt-created',
        token: 'resumed-token',
        applicantId: 'app-reconcile',
        levelName: 'test-level',
        sdkConfig: {
            documentDefinitions: { IDENTITY: { country: 'PT', idDocType: 'PASSPORT' } },
            autoSelectDocumentDefinitions: true,
        },
    } as never)
    const { result } = renderHook(() => useSumsubKycFlow({}))
    await act(async () => {
        void result.current.handleInitiateKyc('EU')
    })
    await advance(30_001)
    expect(mockStatus).toHaveBeenCalled()
    expect(mockPlan.mock.calls.length).toBeGreaterThanOrEqual(2)
    expect(mockResume).toHaveBeenCalledTimes(1)
    expect(mockResume.mock.calls[0][0]).toBe('attempt-created')
    expect(result.current.accessToken).toBe('resumed-token')
    expect(result.current.showWrapper).toBe(true)
    expect(result.current.error).toBeFalsy()
    expect(mockInitiate).toHaveBeenCalledTimes(1)
    await act(async () => {
        start.resolve(started('late-original-after-resume'))
    })
    expect(result.current.accessToken).toBe('resumed-token')
})

it('keeps pending timeout recovery read-only through polling and later taps', async () => {
    mockInitiate.mockReturnValueOnce(new Promise(() => {})).mockResolvedValue(started('duplicate-token'))
    mockStatus.mockResolvedValue('PENDING')
    const { result } = renderHook(() => useSumsubKycFlow({}))
    await act(async () => {
        void result.current.handleInitiateKyc('EU')
    })
    await advance(30_001)
    expect(result.current.isVerificationProgressModalOpen).toBe(true)
    await advance(60_000)
    await act(async () => {
        void result.current.handleInitiateKyc('EU')
    })
    await advance(60_000)
    expect(mockInitiate).toHaveBeenCalledTimes(1)
    expect(result.current.accessToken).toBeFalsy()
})

it('does not start another initiation while a reconciliation status read is stalled', async () => {
    const status = deferred<Awaited<ReturnType<typeof getKycDocumentStatus>>>()
    mockInitiate.mockReturnValueOnce(new Promise(() => {})).mockResolvedValue(started('duplicate-token'))
    mockStatus.mockReturnValue(status.promise)
    const { result } = renderHook(() => useSumsubKycFlow({}))
    await act(async () => {
        void result.current.handleInitiateKyc('EU')
    })
    await advance(30_001)
    expect(mockStatus).toHaveBeenCalledTimes(1)
    await act(async () => {
        for (let tap = 0; tap < 20; tap++) void result.current.handleInitiateKyc('EU')
    })
    expect(mockInitiate).toHaveBeenCalledTimes(1)
    expect(mockStatus).toHaveBeenCalledTimes(1)
    await act(async () => {
        status.resolve(undefined)
    })
    expect(mockInitiate).toHaveBeenCalledTimes(1)
})

it('closing after a timeout fences the late token and reopening only reconciles', async () => {
    const start = deferred<Awaited<ReturnType<typeof initiateSumsubKyc>>>()
    mockInitiate.mockReturnValueOnce(start.promise).mockResolvedValue(started('duplicate-token'))
    mockStatus.mockResolvedValue(undefined)
    const { result } = renderHook(() => useSumsubKycFlow({}))
    await act(async () => {
        void result.current.handleInitiateKyc('EU')
    })
    await advance(90_001)
    act(() => {
        result.current.handleClose()
    })
    await act(async () => {
        start.resolve(started('closed-flow-token'))
    })
    expect(result.current.showWrapper).toBe(false)
    expect(result.current.accessToken).toBeFalsy()
    const readsBeforeReopen = mockStatus.mock.calls.length
    await act(async () => {
        void result.current.handleInitiateKyc('EU')
    })
    await advance(90_001)
    expect(mockStatus.mock.calls.length).toBeGreaterThan(readsBeforeReopen)
    expect(mockInitiate).toHaveBeenCalledTimes(1)
    expect(result.current.showWrapper).toBe(false)
    expect(result.current.accessToken).toBeFalsy()
})

it('does not treat base identity approval as successful cross-region recovery', async () => {
    mockInitiate.mockReturnValue(new Promise(() => {}))
    mockStatus.mockResolvedValue('APPROVED')
    const onKycSuccess = jest.fn()
    const { result } = renderHook(() => useSumsubKycFlow({ onKycSuccess }))
    await act(async () => {
        void result.current.handleInitiateKyc('NA', undefined, true, 'US')
    })
    await advance(90_001)
    expect(mockStatus).toHaveBeenCalled()
    expect(onKycSuccess).not.toHaveBeenCalled()
    expect(mockInitiate).toHaveBeenCalledTimes(1)
    expect(result.current.showWrapper).toBe(false)
})

it('recovers a timed-out correction by reading and refreshing the existing session generation', async () => {
    const session = {
        id: 'session-existing',
        generation: 2,
        state: 'CORRECTION_REQUIRED' as const,
        reasonCode: 'INVALID_TAX_ID',
        targetCountry: 'BR',
        externalActionId: 'action-existing',
        isMultiLevel: false,
    }
    jest.mocked(startKycAction).mockResolvedValue({ data: { levelName: 'test-level', session } })
    jest.mocked(getVerificationSession).mockResolvedValue({ ...session, generation: 3, state: 'COLLECTING' })
    jest.mocked(refreshVerificationSession).mockResolvedValue('session-generation-3-token')
    mockInitiate.mockReturnValue(new Promise(() => {}))
    const { result } = renderHook(() => useSumsubKycFlow({}))
    await act(async () => {
        await result.current.handleStartAction('action-existing')
    })
    expect(result.current.showCorrection).toBe(true)
    await act(async () => {
        void result.current.correctVerificationData()
    })
    expect(mockInitiate).toHaveBeenCalledTimes(1)
    await advance(30_001)
    expect(getVerificationSession).toHaveBeenCalled()
    expect(jest.mocked(getVerificationSession).mock.calls[0][0]).toBe('session-existing')
    expect(refreshVerificationSession).toHaveBeenCalledTimes(1)
    expect(jest.mocked(refreshVerificationSession).mock.calls[0][0]).toEqual({
        id: 'session-existing',
        generation: 3,
    })
    expect(result.current.accessToken).toBe('session-generation-3-token')
    expect(result.current.showWrapper).toBe(true)
    expect(result.current.error).toBeFalsy()
    expect(mockInitiate).toHaveBeenCalledTimes(1)
    expect(startKycAction).toHaveBeenCalledTimes(1)
})

it('closing during initial initiation blocks its late SDK and reopening reconciles only', async () => {
    const start = deferred<Awaited<ReturnType<typeof initiateSumsubKyc>>>()
    mockInitiate.mockReturnValueOnce(start.promise).mockResolvedValue(started('duplicate-token'))
    mockStatus.mockResolvedValue(undefined)
    const { result } = renderHook(() => useSumsubKycFlow({}))
    await act(async () => {
        void result.current.handleInitiateKyc('EU')
    })
    expect(mockInitiate).toHaveBeenCalledTimes(1)
    act(() => {
        result.current.handleClose()
    })
    await act(async () => {
        start.resolve(started('closed-initial-token'))
    })
    expect(result.current.showWrapper).toBe(false)
    expect(result.current.accessToken).toBeFalsy()
    const readsBeforeReopen = mockStatus.mock.calls.length
    await act(async () => {
        void result.current.handleInitiateKyc('EU')
    })
    await advance(90_001)
    expect(mockStatus.mock.calls.length).toBeGreaterThan(readsBeforeReopen)
    expect(mockInitiate).toHaveBeenCalledTimes(1)
    expect(result.current.showWrapper).toBe(false)
})

it('a delayed background plan cannot initiate over an in-flight user start', async () => {
    const backgroundPlan = deferred<Awaited<ReturnType<typeof findKycDocumentPlan>>>()
    mockPlan.mockReturnValueOnce(backgroundPlan.promise).mockResolvedValue(legacyPlan as never)
    mockInitiate.mockReturnValue(new Promise(() => {}))
    const { result } = renderHook(() => useSumsubKycFlow({ regionIntent: 'EU' }))
    await act(async () => {})
    expect(mockPlan).toHaveBeenCalledTimes(1)
    expect(mockInitiate).not.toHaveBeenCalled()
    await act(async () => {
        void result.current.handleInitiateKyc('EU')
    })
    expect(mockPlan).toHaveBeenCalledTimes(2)
    expect(mockInitiate).toHaveBeenCalledTimes(1)
    await act(async () => {
        backgroundPlan.resolve(legacyPlan as never)
    })
    expect(mockInitiate).toHaveBeenCalledTimes(1)
    await advance(90_001)
    expect(mockInitiate).toHaveBeenCalledTimes(1)
})
