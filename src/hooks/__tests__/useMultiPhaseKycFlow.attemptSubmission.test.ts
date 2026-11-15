/**
 * A verification attempt that submits in the SDK is followed on /verify's own
 * status screens; every other flow keeps the progress modal after the SDK.
 */
jest.mock('@/app/actions/kyc-workflow', () => ({
    findKycDocumentPlan: jest.fn(),
    getKycDocumentStatus: jest.fn(),
    resumeKycDocumentAttempt: jest.fn(),
    findKycReplacementPlan: jest.fn(async () => null),
}))
import { act } from '@testing-library/react'
import posthog from 'posthog-js'
import { renderHookWithIntl as renderHook } from '@/test-utils/intl'
import { useMultiPhaseKycFlow } from '@/hooks/useMultiPhaseKycFlow'
import {
    findKycDocumentPlan,
    findKycReplacementPlan,
    getKycDocumentStatus,
    resumeKycDocumentAttempt,
} from '@/app/actions/kyc-workflow'
import { initiateSumsubKyc, restartIdentityVerification } from '@/app/actions/sumsub'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'

const mockWs: { handler?: (status: string, labels?: string[]) => void } = {}
const mockFetchUser = jest.fn()

jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))
jest.mock('@/app/actions/sumsub', () => ({
    ...jest.requireActual('@/app/actions/sumsub'),
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
const mockPush = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush, replace: jest.fn() }) }))
jest.mock('@/utils/capacitor', () => ({ isCapacitor: () => false, isAndroidNative: () => false }))
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ fetchUser: mockFetchUser, user: { user: { username: 'test' } } }),
}))
jest.mock('@/hooks/useCapabilities', () => ({ useCapabilities: () => ({ capabilities: undefined }) }))
jest.mock('@/hooks/useSumsubReloadResume', () => ({ useSumsubReloadResume: jest.fn() }))
jest.mock('@/hooks/useSubmissionWindow', () => ({ markSubmitted: jest.fn() }))
jest.mock('@/app/actions/users', () => ({ getBridgeTosLink: jest.fn(), confirmBridgeTos: jest.fn() }))

const mockCapture = posthog.capture as jest.MockedFunction<typeof posthog.capture>
const captured = (event: string) => mockCapture.mock.calls.filter(([name]) => name === event)

const plan = {
    available: true,
    activeAttemptId: null,
    policyVersion: 'v1',
    flow: 'verify-once' as const,
    features: { qr: true, local: false, bank: true, card: false },
    routes: [],
}
const session = {
    attemptId: 'attempt-1',
    token: 'attempt-token',
    applicantId: 'applicant-1',
    levelName: 'shared',
    status: 'COLLECTING',
    sdkConfig: {
        documentDefinitions: { IDENTITY: { country: 'BRA', idDocType: 'PASSPORT' } },
        autoSelectDocumentDefinitions: true as const,
    },
}

/** A saved replacement resumes its canonical document attempt. */
const openReplacementAttempt = async (options: Parameters<typeof useMultiPhaseKycFlow>[0] = {}) => {
    jest.mocked(findKycReplacementPlan).mockResolvedValueOnce({ ...plan, activeAttemptId: 'attempt-1' })
    jest.mocked(resumeKycDocumentAttempt).mockResolvedValue(session)
    const view = renderHook(() => useMultiPhaseKycFlow(options))
    await act(async () => {
        await view.result.current.handleRestartIdentity()
    })
    expect(view.result.current.showWrapper).toBe(true)
    expect(view.result.current.documentAttemptId).toBe('attempt-1')
    return view
}

beforeEach(() => {
    jest.clearAllMocks()
    mockFetchUser.mockResolvedValue(null)
    jest.mocked(findKycDocumentPlan).mockResolvedValue(plan)
    jest.mocked(findKycReplacementPlan).mockResolvedValue(null)
    jest.mocked(getKycDocumentStatus).mockResolvedValue('NOT_STARTED')
})

describe('useMultiPhaseKycFlow — rejected and action-required new-flow entry', () => {
    it.each(['REJECTED', 'ACTION_REQUIRED'] as const)(
        '%s stays in /verify without opening legacy verification',
        async (status) => {
            jest.mocked(getKycDocumentStatus).mockResolvedValue(status)
            const view = renderHook(() => useMultiPhaseKycFlow({}))
            await act(async () => {
                await view.result.current.handleInitiateKyc()
            })
            expect(mockPush).toHaveBeenCalledWith('/verify')
            expect(initiateSumsubKyc).not.toHaveBeenCalled()
            expect(restartIdentityVerification).not.toHaveBeenCalled()
            expect(resumeKycDocumentAttempt).not.toHaveBeenCalled()
            expect(view.result.current.showWrapper).toBe(false)
            expect(view.result.current.isModalOpen).toBe(false)
            expect(view.result.current.documentAttemptId).toBeNull()
        }
    )
})

describe('useMultiPhaseKycFlow — a submitted verification attempt goes to /verify', () => {
    it('a resumed replacement closes the SDK, opens /verify and shows no modal here', async () => {
        const view = await openReplacementAttempt()

        act(() => view.result.current.handleSdkComplete())

        expect(mockPush).toHaveBeenCalledWith('/verify')
        expect(view.result.current.showWrapper).toBe(false)
        expect(view.result.current.isModalOpen).toBe(false)
        expect(captured(ANALYTICS_EVENTS.KYC_SUBMITTED)).toHaveLength(1)
    })

    it('a later approval starts nothing here', async () => {
        const onKycSuccess = jest.fn()
        const onKycApproved = jest.fn()
        const view = await openReplacementAttempt({ onKycSuccess, onKycApproved })
        act(() => view.result.current.handleSdkComplete())

        await act(async () => {
            mockWs.handler?.('APPROVED')
        })

        expect(view.result.current.isModalOpen).toBe(false)
        expect(onKycApproved).not.toHaveBeenCalled()
        expect(onKycSuccess).not.toHaveBeenCalled()
        expect(mockFetchUser).not.toHaveBeenCalled()
    })

    it('an approval while the attempt is still open takes the same way', async () => {
        const onKycSuccess = jest.fn()
        const view = await openReplacementAttempt({ onKycSuccess })

        await act(async () => {
            mockWs.handler?.('APPROVED')
        })

        expect(mockPush).toHaveBeenCalledWith('/verify')
        expect(view.result.current.showWrapper).toBe(false)
        expect(view.result.current.isModalOpen).toBe(false)
        expect(onKycSuccess).not.toHaveBeenCalled()
    })

    it('a resumed identity replacement goes to /verify after it submits', async () => {
        jest.mocked(findKycReplacementPlan).mockResolvedValueOnce({ ...plan, activeAttemptId: 'replacement-1' })
        jest.mocked(resumeKycDocumentAttempt).mockResolvedValue({ ...session, attemptId: 'replacement-1' })
        const view = renderHook(() => useMultiPhaseKycFlow({}))
        await act(async () => {
            await view.result.current.handleRestartIdentity()
        })
        expect(view.result.current.showWrapper).toBe(true)
        expect(restartIdentityVerification).not.toHaveBeenCalled()

        act(() => view.result.current.handleSdkComplete())

        expect(mockPush).toHaveBeenCalledWith('/verify')
        expect(view.result.current.isModalOpen).toBe(false)
    })

    it('closing the SDK without submitting keeps the user where they are', async () => {
        const onManualClose = jest.fn()
        const view = await openReplacementAttempt({ onManualClose })

        act(() => view.result.current.handleSdkClose())

        expect(onManualClose).toHaveBeenCalledTimes(1)
        expect(mockPush).not.toHaveBeenCalled()
        expect(view.result.current.showWrapper).toBe(false)
        expect(view.result.current.isModalOpen).toBe(false)
    })

    it('an approval after closing without submitting starts none of the legacy post-approval steps', async () => {
        const onKycSuccess = jest.fn()
        const onKycApproved = jest.fn()
        const view = await openReplacementAttempt({ onKycSuccess, onKycApproved })
        act(() => view.result.current.handleSdkClose())

        await act(async () => {
            mockWs.handler?.('APPROVED')
        })

        expect(onKycSuccess).not.toHaveBeenCalled()
        expect(onKycApproved).not.toHaveBeenCalled()
        expect(view.result.current.isModalOpen).toBe(false)
    })
})

describe('useMultiPhaseKycFlow — every other flow keeps the progress modal', () => {
    it('a legacy submission opens the progress modal and stays on the page', async () => {
        jest.mocked(findKycDocumentPlan).mockResolvedValue({ ...plan, available: false, flow: null })
        jest.mocked(initiateSumsubKyc).mockResolvedValue({
            data: { token: 'legacy-token', applicantId: 'applicant-1', status: 'PENDING' },
        })
        const view = renderHook(() => useMultiPhaseKycFlow({}))
        await act(async () => {
            await view.result.current.handleInitiateKyc('STANDARD')
        })
        expect(view.result.current.documentAttemptId).toBeNull()

        act(() => view.result.current.handleSdkComplete())

        expect(view.result.current.showWrapper).toBe(false)
        expect(view.result.current.isModalOpen).toBe(true)
        expect(view.result.current.modalPhase).toBe('verifying')
        expect(mockPush).not.toHaveBeenCalled()
    })
})
