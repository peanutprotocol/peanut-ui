jest.mock('@/utils/native-platform', () => require('@/test-utils/native-platform-mock').createNativePlatformMock())

import { refreshKycIdentityStatus } from '@/app/actions/kyc-workflow'
import { act } from '@testing-library/react'
import { renderHookWithIntl as renderHook } from '@/test-utils/intl'
import { useSumsubKycFlow } from '@/hooks/useSumsubKycFlow'
import { initiateSumsubKyc } from '@/app/actions/sumsub'

jest.mock('@/app/actions/kyc-workflow', () => {
    const getKycDocumentPlan = jest.fn(async () => ({ available: false, routes: [] }))
    return {
        getKycDocumentStatus: jest.fn(async () => 'IN_REVIEW'),
        refreshKycIdentityStatus: jest.fn(async () => undefined),
        getKycDocumentPlan,
        findKycDocumentPlan: jest.fn(() => getKycDocumentPlan().catch(() => null)),
        resumeKycDocumentAttempt: jest.fn(),
        findKycReplacementPlan: jest.fn(async () => null),
    }
})

const mockWs: { handler?: (status: string, labels?: string[]) => void } = {}
jest.mock('@/app/actions/sumsub', () => ({
    ...jest.requireActual('@/app/actions/sumsub'),
    initiateSumsubKyc: jest.fn(),
    initiateSelfHealResubmission: jest.fn(),
    restartIdentityVerification: jest.fn(),
    startResidenceChangeVerification: jest.fn(),
    startKycAction: jest.fn(),
    refreshVerificationSession: jest.fn(),
    getVerificationSession: jest.fn(async () => null),
}))
jest.mock('@/utils/api-fetch', () => ({ serverFetch: jest.fn() }))

jest.mock('@/hooks/useWebSocket', () => ({
    useWebSocket: (opts: { onSumsubKycStatusUpdate?: (status: string, labels?: string[]) => void }) => {
        mockWs.handler = opts.onSumsubKycStatusUpdate
    },
}))
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ user: { user: { username: 'test' } } }) }))
const mockRouterPush = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockRouterPush, replace: jest.fn() }) }))
jest.mock('@/utils/capacitor', () => ({ isCapacitor: () => false }))

const mockInitiate = initiateSumsubKyc as jest.MockedFunction<typeof initiateSumsubKyc>
const mockIdentityRefresh = jest.mocked(refreshKycIdentityStatus)
const pending = <T>() => {
    let resolve!: (value: T) => void
    const promise = new Promise<T>((done) => {
        resolve = done
    })
    return { promise, resolve }
}

describe('SDK close identity recovery', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockIdentityRefresh.mockResolvedValue(undefined)
        mockInitiate.mockResolvedValue({ data: { token: 'initial', applicantId: 'app', status: 'NOT_STARTED' } })
    })

    it('refreshes once after an unsubmitted close, then refetches identity without reopening or completing', async () => {
        const refresh = pending<undefined>()
        mockIdentityRefresh.mockReturnValue(refresh.promise)
        const onKycSuccess = jest.fn()
        const { result } = renderHook(() => useSumsubKycFlow({ onKycSuccess }))
        await act(async () => {
            await result.current.handleInitiateKyc('ROW')
        })
        expect(result.current.showWrapper).toBe(true)
        mockInitiate.mockClear()
        mockInitiate.mockResolvedValue({ data: { token: 'do-not-open', applicantId: 'app', status: 'APPROVED' } })
        act(() => {
            result.current.handleClose()
            result.current.handleClose()
        })
        expect(result.current.showWrapper).toBe(false)
        expect(mockIdentityRefresh).toHaveBeenCalledTimes(1)
        expect(mockInitiate).not.toHaveBeenCalled()
        await act(async () => {
            refresh.resolve(undefined)
        })
        expect(mockInitiate).toHaveBeenCalledTimes(1)
        expect(result.current.liveKycStatus).toBe('APPROVED')
        expect(result.current.showWrapper).toBe(false)
        expect(result.current.accessToken).toBe('initial')
        expect(onKycSuccess).not.toHaveBeenCalled()
    })

    it('does not refresh an SDK session already completed by submission', async () => {
        const { result } = renderHook(() => useSumsubKycFlow())
        await act(async () => {
            await result.current.handleInitiateKyc('ROW')
        })
        act(() => {
            result.current.handleSdkComplete()
            result.current.handleClose()
        })
        expect(mockIdentityRefresh).not.toHaveBeenCalled()
    })

    it('does not publish a stale close refresh over a newly opened SDK', async () => {
        const refresh = pending<undefined>()
        mockIdentityRefresh.mockReturnValue(refresh.promise)
        const { result } = renderHook(() => useSumsubKycFlow())
        await act(async () => {
            await result.current.handleInitiateKyc('ROW')
        })
        act(() => {
            result.current.handleClose()
        })
        await act(async () => {
            await result.current.handleInitiateKyc('ROW')
        })
        mockInitiate.mockClear()
        await act(async () => {
            refresh.resolve(undefined)
        })
        expect(mockInitiate).not.toHaveBeenCalled()
        expect(result.current.showWrapper).toBe(true)
    })

    it('does not refresh a submitted multi-level session that closes before completion', async () => {
        const { result } = renderHook(() => useSumsubKycFlow())
        await act(async () => {
            await result.current.handleInitiateKyc('EU')
        })
        expect(result.current.showWrapper).toBe(true)
        jest.mocked(refreshKycIdentityStatus).mockClear()
        act(() => {
            result.current.handleSdkSubmitted()
            result.current.handleClose()
        })
        expect(refreshKycIdentityStatus).not.toHaveBeenCalled()
        expect(result.current.showWrapper).toBe(false)
    })
})
