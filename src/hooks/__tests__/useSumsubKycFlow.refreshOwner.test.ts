jest.mock('@/utils/native-platform', () => require('@/test-utils/native-platform-mock').createNativePlatformMock())

import { act } from '@testing-library/react'
import { renderHookWithIntl as renderHook } from '@/test-utils/intl'
import { useSumsubKycFlow } from '@/hooks/useSumsubKycFlow'
import { startKycAction } from '@/app/actions/sumsub'
import { restartIdentityVerification } from '@/app/actions/sumsub'
import { findKycReplacementPlan, resumeKycDocumentAttempt } from '@/app/actions/kyc-workflow'

jest.mock('@/utils/session-fence', () => ({
    captureSessionFence: (_owner: string, active: () => boolean) => ({ current: active }),
}))

jest.mock('@/app/actions/kyc-workflow', () => {
    const getKycDocumentPlan = jest.fn(async () => ({ available: false, routes: [] }))
    return {
        getKycDocumentStatus: jest.fn(async () => 'IN_REVIEW'),
        getKycDocumentPlan,
        findKycDocumentPlan: jest.fn(() => getKycDocumentPlan().catch(() => null)),
        resumeKycDocumentAttempt: jest.fn(),
        findKycReplacementPlan: jest.fn(async () => null),
    }
})

describe('identity restart account isolation', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        ;(findKycReplacementPlan as jest.Mock).mockReset().mockResolvedValue(null)
        mockUserId = 'account-A'
    })

    it.each([null, { activeAttemptId: 'attempt-A' }, { available: true }])(
        'does not dispatch or navigate after account change while replacement plan is pending (%s)',
        async (plan) => {
            let finishPlan!: (value: any) => void
            ;(findKycReplacementPlan as jest.Mock).mockImplementationOnce(
                () => new Promise((resolve) => (finishPlan = resolve))
            )
            const { result, rerender } = renderHook(() => useSumsubKycFlow())
            let pending!: Promise<boolean>
            await act(async () => {
                pending = result.current.handleRestartIdentity()
                await Promise.resolve()
            })
            mockUserId = 'account-B'
            rerender()
            await act(async () => {
                finishPlan(plan)
                await pending
            })
            expect(restartIdentityVerification).not.toHaveBeenCalled()
            expect(resumeKycDocumentAttempt).not.toHaveBeenCalled()
            expect(mockRouterPush).not.toHaveBeenCalled()
            expect(result.current.showWrapper).toBe(false)
            expect(result.current.accessToken).toBeNull()
        }
    )

    it('does not show a late restart token after account change', async () => {
        let finishRestart!: (value: any) => void
        ;(restartIdentityVerification as jest.Mock).mockImplementationOnce(
            () => new Promise((resolve) => (finishRestart = resolve))
        )
        const { result, rerender } = renderHook(() => useSumsubKycFlow())
        let pending!: Promise<boolean>
        await act(async () => {
            pending = result.current.handleRestartIdentity()
            await Promise.resolve()
            await Promise.resolve()
        })
        expect(restartIdentityVerification).toHaveBeenCalledTimes(1)
        mockUserId = 'account-B'
        rerender()
        await act(async () => {
            finishRestart({ data: { token: 'A-token' } })
            await pending
        })
        expect(result.current.showWrapper).toBe(false)
        expect(result.current.accessToken).toBeNull()
    })

    it('clears loading and ignores the plan after the restart is closed', async () => {
        let finishPlan!: (value: any) => void
        ;(findKycReplacementPlan as jest.Mock).mockImplementationOnce(
            () => new Promise((resolve) => (finishPlan = resolve))
        )
        const { result } = renderHook(() => useSumsubKycFlow())
        let pending!: Promise<boolean>
        await act(async () => {
            pending = result.current.handleRestartIdentity()
            await Promise.resolve()
        })
        act(() => result.current.handleClose())
        expect(result.current.isLoading).toBe(false)
        await act(async () => {
            finishPlan(null)
            await pending
        })
        expect(restartIdentityVerification).not.toHaveBeenCalled()
        expect(result.current.showWrapper).toBe(false)
    })

    it('opens a current attempt for the same account', async () => {
        ;(findKycReplacementPlan as jest.Mock).mockResolvedValueOnce({ activeAttemptId: 'attempt-A' })
        ;(resumeKycDocumentAttempt as jest.Mock).mockResolvedValueOnce({
            attemptId: 'attempt-A',
            token: 'current-token',
            applicantId: 'applicant-A',
            sdkConfig: {},
        })
        const { result } = renderHook(() => useSumsubKycFlow())
        await act(async () => {
            await result.current.handleRestartIdentity()
        })
        expect(resumeKycDocumentAttempt).toHaveBeenCalledWith('attempt-A', expect.any(Function))
        expect(result.current.showWrapper).toBe(true)
        expect(result.current.accessToken).toBe('current-token')
    })
})

const mockWs: { handler?: (status: string, labels?: string[]) => void } = {}
jest.mock('@/app/actions/sumsub', () => ({
    ...jest.requireActual('@/app/actions/sumsub'),
    // Only the network-touching actions are stubbed. Pure helpers like
    // isTerminalActionCode come from the real module: they encode which
    // refusals are permanent, and a stub would let the hook's terminal
    // branch pass a test while doing nothing in production.
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
let mockUserId = 'account-A'
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ user: { user: { userId: mockUserId, username: mockUserId } } }),
}))
const mockRouterPush = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockRouterPush, replace: jest.fn() }) }))
jest.mock('@/utils/capacitor', () => ({ isCapacitor: () => false }))

const mockStartAction = startKycAction as jest.MockedFunction<typeof startKycAction>

const addressKey = 'sumsub:address_of_residence'
describe('address SDK refresh account isolation', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockStartAction.mockReset()
        mockUserId = 'account-A'
    })
    it('rejects a captured A SDK callback after switching to B without dispatching', async () => {
        const dispatchOwners: string[] = []
        mockStartAction.mockImplementation(async () => {
            dispatchOwners.push(mockUserId)
            return { data: { token: `${mockUserId}-token`, levelName: 'provider-rfi-address' } }
        })
        const { result, rerender } = renderHook(() => useSumsubKycFlow())
        await act(async () => {
            await result.current.handleStartAction(addressKey)
        })
        const oldSdkRefresh = result.current.refreshToken
        mockUserId = 'account-B'
        rerender()
        expect(result.current.accessToken).toBeNull()
        expect(result.current.showWrapper).toBe(false)
        await act(async () => {
            await expect(oldSdkRefresh()).rejects.toThrow('Address verification session changed')
        })
        expect(dispatchOwners).toEqual(['account-A'])
        expect(result.current.accessToken).toBeNull()
        expect(result.current.showWrapper).toBe(false)
    })
    it.each(['account-A', 'account-B'])(
        'rejects an old refresh without overwriting a new flow for %s',
        async (nextOwner) => {
            let resolveOldRefresh!: (value: any) => void
            mockStartAction
                .mockResolvedValueOnce({ data: { token: 'A-initial', levelName: 'provider-rfi-address' } })
                .mockImplementationOnce(
                    () =>
                        new Promise((resolve) => {
                            resolveOldRefresh = resolve
                        })
                )
                .mockResolvedValueOnce({ data: { token: 'B-initial', levelName: 'provider-rfi-address' } })
            const { result, rerender } = renderHook(() => useSumsubKycFlow())
            await act(async () => {
                await result.current.handleStartAction(addressKey)
            })
            let pending!: Promise<string>
            act(() => {
                pending = result.current.refreshToken()
            })
            mockUserId = nextOwner
            rerender()
            await act(async () => {
                await result.current.handleStartAction(addressKey)
            })
            expect(result.current.accessToken).toBe('B-initial')
            expect(result.current.showWrapper).toBe(true)
            await act(async () => {
                resolveOldRefresh({ data: { token: 'A-late-refresh', levelName: 'provider-rfi-address' } })
                await expect(pending).rejects.toThrow('Address verification session changed')
            })
            expect(result.current.accessToken).toBe('B-initial')
            expect(result.current.showWrapper).toBe(true)
        }
    )
    it('refreshes the current address session normally', async () => {
        mockStartAction
            .mockResolvedValueOnce({ data: { token: 'initial', levelName: 'provider-rfi-address' } })
            .mockResolvedValueOnce({ data: { token: 'refreshed', levelName: 'provider-rfi-address' } })
        const { result } = renderHook(() => useSumsubKycFlow())
        await act(async () => {
            await result.current.handleStartAction(addressKey)
        })
        await act(async () => {
            await expect(result.current.refreshToken()).resolves.toBe('refreshed')
        })
        expect(result.current.accessToken).toBe('refreshed')
        expect(result.current.showWrapper).toBe(true)
    })
    it.each(['close', 'unmount'])('rejects an address callback after %s without another request', async (end) => {
        mockStartAction.mockResolvedValue({ data: { token: 'initial', levelName: 'provider-rfi-address' } })
        const { result, unmount } = renderHook(() => useSumsubKycFlow())
        await act(async () => {
            await result.current.handleStartAction(addressKey)
        })
        const oldSdkRefresh = result.current.refreshToken
        act(() => {
            if (end === 'close') result.current.handleClose()
            else unmount()
        })
        await expect(oldSdkRefresh()).rejects.toThrow('Address verification session changed')
        expect(mockStartAction).toHaveBeenCalledTimes(1)
    })
})
