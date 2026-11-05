jest.mock('@/app/actions/kyc-workflow', () => ({
    findKycDocumentPlan: jest.fn(async () => ({ available: false, flow: null })),
    getKycDocumentStatus: jest.fn(async () => 'NOT_STARTED'),
    findKycReplacementPlan: jest.fn(async () => null),
    resumeKycDocumentAttempt: jest.fn(),
}))

jest.mock('@/utils/native-platform', () => require('@/test-utils/native-platform-mock').createNativePlatformMock())

import { act } from '@testing-library/react'
import { renderHookWithIntl as renderHook } from '@/test-utils/intl'
import { useMultiPhaseKycFlow } from '@/hooks/useMultiPhaseKycFlow'
import {
    getVerificationSession,
    initiateSumsubKyc,
    restartIdentityVerification,
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
const mockRestartIdentity = restartIdentityVerification as jest.MockedFunction<typeof restartIdentityVerification>

// Spec extension: correction copy follows the current session/action only.
// Written from test-only contracts; production source intentionally unread.
const mockGetSession = getVerificationSession as jest.MockedFunction<typeof getVerificationSession>
const session = (state: 'CORRECTION_REQUIRED' | 'COLLECTING' | 'SUBMISSION_PENDING', generation = 4) => ({
    id: 'session-correction',
    generation,
    state,
    reasonCode: state === 'CORRECTION_REQUIRED' ? 'INVALID_TAX_ID' : null,
    targetCountry: 'AR',
    externalActionId: `fixture-action-${generation}`,
    isMultiLevel: false,
})
const response = (state: Parameters<typeof session>[0], token: string | null = null, generation = 4) => ({
    data: {
        token,
        applicantId: 'fixture-applicant',
        status: token ? ('APPROVED' as const) : ('IN_REVIEW' as const),
        actionType: 'manteca' as const,
        session: session(state, generation),
    },
})
const openCorrection = async () => {
    mockInitiate.mockResolvedValue(response('CORRECTION_REQUIRED'))
    mockGetSession.mockResolvedValue(session('CORRECTION_REQUIRED'))
    const view = renderHook(() => useMultiPhaseKycFlow({}))
    await act(async () => {
        await view.result.current.handleInitiateKyc('LATAM', undefined, true, 'AR')
    })
    expect(view.result.current.showCorrection).toBe(true)
    expect(view.result.current.taxIdCorrection).toBe(true)
    return view
}

describe('CUIT correction reason belongs to the active verification session', () => {
    beforeEach(() => {
        jest.useFakeTimers()
        jest.clearAllMocks()
        mockInitiate.mockReset()
        mockGetSession.mockReset()
        mockFetchUser.mockReset()
        mockFetchUser.mockResolvedValue(null)
        mockWs.handler = undefined
        mockResidenceChange.mockResolvedValue({
            data: {
                token: 'fixture-residence-token',
                applicantId: 'fixture-applicant',
                levelName: 'peanut-residence-change',
                targetCountry: 'PT',
            },
        })
        mockRestartIdentity.mockResolvedValue({ data: { token: 'fixture-restart-token' } } as never)
    })
    afterEach(() => jest.useRealTimers())

    it('INVALID_TAX_ID remains explicit after dismissing and reopening the same correction', async () => {
        const { result } = await openCorrection()
        act(() => result.current.handleModalClose())
        await act(async () => {
            await result.current.handleInitiateKyc('LATAM', undefined, true, 'AR')
        })
        expect(result.current.taxIdCorrection).toBe(true)
        expect(result.current.showCorrection).toBe(true)
        expect(result.current.showWrapper).toBe(false)
    })

    it('an INVALID_TAX_ID found by polling sets the correction reason', async () => {
        mockInitiate.mockResolvedValue(response('SUBMISSION_PENDING'))
        mockGetSession.mockResolvedValue(session('SUBMISSION_PENDING'))
        const { result } = renderHook(() => useMultiPhaseKycFlow({}))
        await act(async () => {
            await result.current.handleInitiateKyc('LATAM', undefined, true, 'AR')
        })
        expect(result.current.taxIdCorrection).toBe(false)
        mockGetSession.mockResolvedValue(session('CORRECTION_REQUIRED'))
        await act(async () => {
            await jest.advanceTimersByTimeAsync(8000)
        })
        expect(result.current.taxIdCorrection).toBe(true)
        expect(result.current.showCorrection).toBe(true)
    })

    it('launching residence change clears a prior tax-ID correction reason', async () => {
        const { result } = await openCorrection()
        await act(async () => {
            await result.current.handleResidenceChange('PT')
        })
        expect(mockResidenceChange).toHaveBeenCalledWith('PT')
        expect(result.current.showWrapper).toBe(true)
        expect(result.current.taxIdCorrection).toBe(false)
        await act(async () => {
            await jest.advanceTimersByTimeAsync(12000)
        })
        expect(result.current.taxIdCorrection).toBe(false)
        act(() => result.current.handleSdkComplete())
        expect(result.current.taxIdCorrection).toBe(false)
        expect(result.current.showWrapper).toBe(false)
        expect(result.current.isModalOpen).toBe(false)
    })

    it('restart identity clears a prior tax-ID correction reason', async () => {
        const { result } = await openCorrection()
        await act(async () => {
            await result.current.handleRestartIdentity()
        })
        expect(mockRestartIdentity).toHaveBeenCalled()
        expect(result.current.showWrapper).toBe(true)
        expect(result.current.taxIdCorrection).toBe(false)
        await act(async () => {
            await jest.advanceTimersByTimeAsync(12000)
        })
        expect(result.current.taxIdCorrection).toBe(false)
    })

    it.each(['prior', 'current'] as const)(
        'a %s SDK teardown callback cannot close a newly opened SDK',
        async (callbackOwner) => {
            mockInitiate.mockResolvedValueOnce(response('COLLECTING', 'fixture-first-token', 4))
            mockGetSession.mockResolvedValue(session('COLLECTING', 4))
            const { result } = renderHook(() => useMultiPhaseKycFlow({}))
            await act(async () => {
                await result.current.handleInitiateKyc('LATAM', undefined, true, 'AR')
            })
            const priorSubmitted = result.current.handleSdkSubmitted
            act(() => result.current.handleSdkClose())
            mockInitiate.mockResolvedValueOnce(response('COLLECTING', 'fixture-new-token', 5))
            mockGetSession.mockResolvedValue(session('COLLECTING', 5))
            await act(async () => {
                await result.current.handleInitiateKyc('LATAM', undefined, true, 'AR')
            })
            expect(result.current.showWrapper).toBe(true)
            act(() => {
                const submit = callbackOwner === 'prior' ? priorSubmitted : result.current.handleSdkSubmitted
                submit('sdk_teardown')
            })
            expect(result.current.showWrapper).toBe(true)
            expect(result.current.modalPhase).not.toBe('submitted')
            expect(mockInitiate).toHaveBeenCalledTimes(2)
        }
    )

    it('current single-level Manteca sdk_submitted enters submitted and closes its SDK', async () => {
        mockInitiate.mockResolvedValue(response('COLLECTING', 'fixture-sdk-token'))
        mockGetSession.mockResolvedValue(session('COLLECTING'))
        const { result } = renderHook(() => useMultiPhaseKycFlow({}))
        await act(async () => {
            await result.current.handleInitiateKyc('LATAM', undefined, true, 'AR')
        })
        expect(result.current.showWrapper).toBe(true)
        act(() => result.current.handleSdkSubmitted('sdk_submitted'))
        expect(result.current.showWrapper).toBe(false)
        expect(result.current.modalPhase).toBe('submitted')
        expect(result.current.isModalOpen).toBe(true)
        expect(result.current.taxIdCorrection).toBe(false)
        expect(mockInitiate).toHaveBeenCalledTimes(1)
    })
})
