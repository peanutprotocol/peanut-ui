jest.mock('@/utils/native-platform', () => require('@/test-utils/native-platform-mock').createNativePlatformMock())

import { act } from '@testing-library/react'
import { renderHookWithIntl as renderHook } from '@/test-utils/intl'
import { useMultiPhaseKycFlow } from '@/hooks/useMultiPhaseKycFlow'
import {
    getVerificationSession,
    refreshVerificationSession,
    initiateSumsubKyc,
    startResidenceChangeVerification,
} from '@/app/actions/sumsub'

// Pins the KYC_REJECTED capture + user-store refresh effect: it must be
// edge-triggered on the status (its other deps churn during resubmit rounds)
// and honor the multi-level deferral's consume-on-submission semantics.

const mockWs: { handler?: (status: string, labels?: string[]) => void } = {}
const mockFetchUser = jest.fn()

jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))
jest.mock('@/app/actions/sumsub', () => ({
    ...jest.requireActual('@/app/actions/sumsub'),
    // Only the network-touching actions are stubbed — pure helpers like
    // isTerminalActionCode must come from the real module, or the hook's
    // terminal-refusal branch calls undefined and every initiate bails.
    initiateSumsubKyc: jest.fn(),
    getVerificationSession: jest.fn(),
    refreshVerificationSession: jest.fn(),
    initiateSelfHealResubmission: jest.fn(),
    restartIdentityVerification: jest.fn(),
    startResidenceChangeVerification: jest.fn(),
    startKycAction: jest.fn(),
}))
jest.mock('@/hooks/useWebSocket', () => ({
    useWebSocket: (opts: { onSumsubKycStatusUpdate?: (status: string, labels?: string[]) => void }) => {
        mockWs.handler = opts.onSumsubKycStatusUpdate
    },
}))
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn(), replace: jest.fn() }) }))
jest.mock('@/utils/capacitor', () => ({ isCapacitor: () => false, isAndroidNative: () => false }))
// the transitive useSumsubKycFlow reads user.user.username off the same useAuth
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ fetchUser: mockFetchUser, user: { user: { username: 'test' } } }),
}))
jest.mock('@/hooks/useCapabilities', () => ({ useCapabilities: () => ({ capabilities: undefined }) }))
jest.mock('@/hooks/useSumsubReloadResume', () => ({ useSumsubReloadResume: jest.fn() }))
jest.mock('@/hooks/useSubmissionWindow', () => ({ markSubmitted: jest.fn() }))
jest.mock('@/utils/capability-gate', () => ({ deriveGate: () => ({ kind: 'none' }) }))
jest.mock('@/app/actions/users', () => ({ getBridgeTosLink: jest.fn(), confirmBridgeTos: jest.fn() }))

const mockInitiate = initiateSumsubKyc as jest.MockedFunction<typeof initiateSumsubKyc>
const mockResidenceChange = startResidenceChangeVerification as jest.MockedFunction<
    typeof startResidenceChangeVerification
>

// Independent acceptance from the CUIT unlock spec. No production source was read.
const pendingStates = ['COLLECTING', 'REVIEW_PENDING', 'SUBMISSION_PENDING', 'PROVIDER_PENDING'] as const
const verificationSession = (
    state: (typeof pendingStates)[number] | 'READY' | 'CORRECTION_REQUIRED' | 'BLOCKED',
    reasonCode: string | null = null
) => ({
    id: 'session-accepted',
    generation: 4,
    state,
    reasonCode,
    targetCountry: 'AR',
    externalActionId: 'action-accepted',
    isMultiLevel: false,
})
const bankSnapshot = (country = 'AR', status = 'enabled') => ({
    capabilities: {
        rails: [
            {
                provider: 'manteca',
                channel: 'bank',
                country,
                currency: country === 'AR' ? 'ARS' : 'BRL',
                status,
                operations: { deposit: status },
            },
        ],
        nextActions: [],
        restrictions: [],
    },
})
const mockGetSession = getVerificationSession as jest.MockedFunction<typeof getVerificationSession>
const tick = async (milliseconds: number) => {
    await act(async () => {
        await jest.advanceTimersByTimeAsync(milliseconds)
    })
}
const openSession = async (state: Parameters<typeof verificationSession>[0], token: string | null = null) => {
    const session = verificationSession(state)
    mockInitiate.mockResolvedValue({
        data: {
            token,
            applicantId: 'fixture-applicant',
            status: 'APPROVED',
            actionType: 'manteca',
            session,
        },
    })
    mockGetSession.mockResolvedValue(session)
    const onKycSuccess = jest.fn()
    const onKycApproved = jest.fn()
    const view = renderHook(() => useMultiPhaseKycFlow({ onKycSuccess, onKycApproved }))
    await act(async () => {
        await view.result.current.handleInitiateKyc('LATAM', undefined, true, 'AR')
    })
    return { ...view, onKycSuccess, onKycApproved }
}

describe('CUIT accepted submission remains submitted until the requested bank is usable', () => {
    beforeEach(() => {
        jest.useFakeTimers()
        jest.clearAllMocks()
        mockInitiate.mockReset()
        mockGetSession.mockReset()
        mockFetchUser.mockReset()
        mockFetchUser.mockResolvedValue(null)
        mockWs.handler = undefined
    })
    afterEach(() => jest.useRealTimers())

    it.each(pendingStates)('tokenless %s reentry opens submitted and outlives the preparing timeout', async (state) => {
        const { result, onKycSuccess, onKycApproved } = await openSession(state)
        expect(result.current.isModalOpen).toBe(true)
        expect(result.current.modalPhase).toBe('submitted')
        expect(result.current.showWrapper).toBe(false)
        mockFetchUser.mockResolvedValue(bankSnapshot())
        await act(async () => {
            mockWs.handler?.('APPROVED')
        })
        await tick(35000)
        expect(result.current.modalPhase).toBe('submitted')
        expect(result.current.preparingTimedOut).toBe(false)
        expect(result.current.isModalOpen).toBe(true)
        expect(onKycSuccess).not.toHaveBeenCalled()
        expect(onKycApproved).not.toHaveBeenCalled()
        expect(mockInitiate).toHaveBeenCalledTimes(1)
        expect(mockGetSession).toHaveBeenCalledWith('session-accepted')
        expect(refreshVerificationSession).not.toHaveBeenCalled()
    })

    it.each(['submitted', 'complete'] as const)(
        'SDK %s enters submitted without waiting for provider completion',
        async (event) => {
            const { result, onKycSuccess, onKycApproved } = await openSession('COLLECTING', 'fixture-sdk-token')
            expect(result.current.showWrapper).toBe(true)
            act(() => {
                if (event === 'submitted') result.current.handleSdkSubmitted()
                else result.current.handleSdkComplete()
            })
            expect(result.current.modalPhase).toBe('submitted')
            expect(result.current.isModalOpen).toBe(true)
            act(() => result.current.handleSdkComplete())
            expect(result.current.showWrapper).toBe(false)
            await tick(35000)
            expect(result.current.modalPhase).toBe('submitted')
            expect(onKycSuccess).not.toHaveBeenCalled()
            expect(onKycApproved).not.toHaveBeenCalled()
            expect(mockInitiate).toHaveBeenCalledTimes(1)
        }
    )

    it('READY requires a freshly usable AR bank and completes at most once', async () => {
        const { onKycSuccess, onKycApproved } = await openSession('PROVIDER_PENDING')
        mockFetchUser.mockResolvedValue(bankSnapshot())
        await tick(4000)
        expect(onKycSuccess).not.toHaveBeenCalled()
        expect(onKycApproved).not.toHaveBeenCalled()
        mockGetSession.mockResolvedValue(verificationSession('READY'))
        mockFetchUser.mockResolvedValue(bankSnapshot('BR'))
        await tick(8000)
        expect(onKycSuccess).not.toHaveBeenCalled()
        expect(onKycApproved).not.toHaveBeenCalled()
        mockFetchUser.mockResolvedValue(bankSnapshot('AR', 'pending'))
        await tick(8000)
        expect(onKycSuccess).not.toHaveBeenCalled()
        mockFetchUser.mockResolvedValue(bankSnapshot('AR', 'enabled'))
        await tick(8000)
        expect(onKycSuccess).toHaveBeenCalledTimes(1)
        await tick(12000)
        expect(onKycSuccess).toHaveBeenCalledTimes(1)
        expect(mockInitiate).toHaveBeenCalledTimes(1)
        expect(mockFetchUser).toHaveBeenCalled()
    })

    it('read-only status transport failures preserve submitted and never initiate automatically', async () => {
        const { result, onKycSuccess, onKycApproved } = await openSession('SUBMISSION_PENDING')
        mockGetSession.mockRejectedValue(new Error('fixture transport failure'))
        await tick(35000)
        expect(result.current.modalPhase).toBe('submitted')
        expect(onKycSuccess).not.toHaveBeenCalled()
        expect(onKycApproved).not.toHaveBeenCalled()
        expect(mockInitiate).toHaveBeenCalledTimes(1)
        expect(refreshVerificationSession).not.toHaveBeenCalled()
    })

    it('dismissal closes submitted and stops read-only progress polling', async () => {
        const { result, onKycSuccess, onKycApproved } = await openSession('REVIEW_PENDING')
        await tick(8000)
        expect(mockGetSession).toHaveBeenCalled()
        act(() => result.current.handleModalClose())
        expect(result.current.isModalOpen).toBe(false)
        const readCount = mockGetSession.mock.calls.length
        const refreshCount = mockFetchUser.mock.calls.length
        await tick(20000)
        expect(mockGetSession).toHaveBeenCalledTimes(readCount)
        expect(mockFetchUser).toHaveBeenCalledTimes(refreshCount)
        expect(mockInitiate).toHaveBeenCalledTimes(1)
        expect(onKycSuccess).not.toHaveBeenCalled()
        expect(onKycApproved).not.toHaveBeenCalled()
    })

    it('an initiation 429 cannot become an automatic initiation retry', async () => {
        mockInitiate.mockResolvedValue({ error: 'Too many attempts. Please wait a minute and try again.' })
        const onKycSuccess = jest.fn()
        const { result } = renderHook(() => useMultiPhaseKycFlow({ onKycSuccess }))
        await act(async () => {
            await result.current.handleInitiateKyc('LATAM', undefined, true, 'AR')
        })
        await tick(65000)
        expect(mockInitiate).toHaveBeenCalledTimes(1)
        expect(onKycSuccess).not.toHaveBeenCalled()
        expect(result.current.modalPhase).not.toBe('submitted')
        expect(result.current.showWrapper).toBe(false)
    })

    it('INVALID_TAX_ID status preserves explicit correction and never succeeds', async () => {
        const { result, onKycSuccess, onKycApproved } = await openSession('SUBMISSION_PENDING')
        mockGetSession.mockResolvedValue(verificationSession('CORRECTION_REQUIRED', 'INVALID_TAX_ID'))
        mockFetchUser.mockResolvedValue(bankSnapshot())
        await tick(8000)
        expect(result.current.showCorrection).toBe(true)
        expect(result.current.modalPhase).not.toBe('submitted')
        expect(result.current.showWrapper).toBe(false)
        expect(onKycSuccess).not.toHaveBeenCalled()
        expect(onKycApproved).not.toHaveBeenCalled()
        expect(mockInitiate).toHaveBeenCalledTimes(1)
        mockInitiate.mockResolvedValueOnce({
            data: {
                token: 'fixture-correction-token',
                applicantId: 'fixture-applicant',
                status: 'APPROVED',
                actionType: 'manteca',
                session: { ...verificationSession('COLLECTING'), generation: 5 },
            },
        })
        await act(async () => {
            await result.current.correctVerificationData()
        })
        expect(mockInitiate).toHaveBeenLastCalledWith(
            expect.objectContaining({
                regionIntent: 'LATAM',
                targetCountry: 'AR',
                correctSession: true,
            })
        )
        expect(result.current.showWrapper).toBe(true)
    })

    it('BLOCKED cannot be presented as accepted submission or success', async () => {
        const { result, onKycSuccess, onKycApproved } = await openSession('SUBMISSION_PENDING')
        mockGetSession.mockResolvedValue(verificationSession('BLOCKED', 'PROVIDER_REJECTED'))
        mockFetchUser.mockResolvedValue(bankSnapshot())
        await tick(8000)
        expect(result.current.modalPhase).not.toBe('submitted')
        expect(result.current.showWrapper).toBe(false)
        expect(onKycSuccess).not.toHaveBeenCalled()
        expect(onKycApproved).not.toHaveBeenCalled()
        expect(mockInitiate).toHaveBeenCalledTimes(1)
    })

    it('residence action completion keeps its existing non-session behavior', async () => {
        mockResidenceChange.mockResolvedValue({
            data: {
                token: 'fixture-residence-token',
                applicantId: 'fixture-applicant',
                levelName: 'peanut-residence-change',
                targetCountry: 'PT',
            },
        })
        const onKycSuccess = jest.fn()
        const { result } = renderHook(() => useMultiPhaseKycFlow({ onKycSuccess }))
        await act(async () => {
            await result.current.handleResidenceChange('PT')
        })
        act(() => result.current.handleSdkComplete())
        expect(result.current.isModalOpen).toBe(false)
        expect(result.current.showWrapper).toBe(false)
        expect(result.current.modalPhase).toBe('verifying')
        expect(onKycSuccess).not.toHaveBeenCalled()
        expect(mockGetSession).not.toHaveBeenCalled()
    })
})
