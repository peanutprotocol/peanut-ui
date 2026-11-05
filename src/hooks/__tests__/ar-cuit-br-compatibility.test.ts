jest.mock('@/utils/native-platform', () => require('@/test-utils/native-platform-mock').createNativePlatformMock())

import { act } from '@testing-library/react'
import { renderHookWithIntl as renderHook } from '@/test-utils/intl'
import { useMultiPhaseKycFlow } from '@/hooks/useMultiPhaseKycFlow'
import { getVerificationSession, initiateSumsubKyc } from '@/app/actions/sumsub'

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

// Scope clarification: submitted/notify UX applies only to Argentina.
// Brazil preserves its existing preparing and SDK submission behavior.
const pendingStates = ['COLLECTING', 'REVIEW_PENDING', 'SUBMISSION_PENDING', 'PROVIDER_PENDING'] as const
const brSession = (state: (typeof pendingStates)[number]) => ({
    id: 'fixture-br-session',
    generation: 2,
    state,
    reasonCode: null,
    targetCountry: 'BR',
    externalActionId: 'fixture-br-action',
    isMultiLevel: false,
})
const mockGetSession = getVerificationSession as jest.MockedFunction<typeof getVerificationSession>
const openBrazil = async (state: (typeof pendingStates)[number], token: string | null = null) => {
    const session = brSession(state)
    mockInitiate.mockResolvedValue({
        data: {
            token,
            applicantId: 'fixture-applicant',
            status: token ? 'APPROVED' : 'IN_REVIEW',
            actionType: 'manteca',
            session,
        },
    })
    mockGetSession.mockResolvedValue(session)
    const onKycSuccess = jest.fn()
    const onKycApproved = jest.fn()
    const view = renderHook(() => useMultiPhaseKycFlow({ onKycSuccess, onKycApproved }))
    await act(async () => {
        await view.result.current.handleInitiateKyc('LATAM', undefined, true, 'BR')
    })
    return { ...view, onKycSuccess, onKycApproved }
}

describe('Brazil compatibility outside the Argentina submitted-notification scope', () => {
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

    it.each(pendingStates)('tokenless BR %s retains preparing rather than submitted', async (state) => {
        const { result, onKycSuccess, onKycApproved } = await openBrazil(state)
        expect(result.current.isModalOpen).toBe(true)
        expect(result.current.showWrapper).toBe(false)
        expect(result.current.modalPhase).toBe('preparing')
        await act(async () => {
            await jest.advanceTimersByTimeAsync(8000)
        })
        expect(result.current.modalPhase).toBe('preparing')
        expect(onKycSuccess).not.toHaveBeenCalled()
        expect(onKycApproved).not.toHaveBeenCalled()
        expect(mockInitiate).toHaveBeenCalledTimes(1)
    })

    it('BR sdk_submitted alone retains the open SDK; completion enters preparing', async () => {
        const { result, onKycSuccess, onKycApproved } = await openBrazil('COLLECTING', 'fixture-br-sdk-token')
        expect(result.current.showWrapper).toBe(true)
        act(() => result.current.handleSdkSubmitted('sdk_submitted'))
        expect(result.current.showWrapper).toBe(true)
        expect(result.current.modalPhase).not.toBe('submitted')
        expect(onKycSuccess).not.toHaveBeenCalled()
        expect(onKycApproved).not.toHaveBeenCalled()
        act(() => result.current.handleSdkComplete())
        expect(result.current.showWrapper).toBe(false)
        expect(result.current.isModalOpen).toBe(true)
        expect(result.current.modalPhase).toBe('preparing')
        expect(onKycSuccess).not.toHaveBeenCalled()
        expect(onKycApproved).not.toHaveBeenCalled()
        expect(mockInitiate).toHaveBeenCalledTimes(1)
    })
})
