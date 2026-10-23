jest.mock('@/utils/native-platform', () => require('@/test-utils/native-platform-mock').createNativePlatformMock())

import { getKycDocumentStatus, getKycDocumentPlan, resumeKycDocumentAttempt } from '@/app/actions/kyc-workflow'
import { act } from '@testing-library/react'
import { renderHookWithIntl as renderHook } from '@/test-utils/intl'
import { useSumsubKycFlow } from '@/hooks/useSumsubKycFlow'
import { initiateSumsubKyc } from '@/app/actions/sumsub'

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

// useSumsubKycFlow wires a websocket, redux, the router and three server actions.
// Stub everything except the one action the cross-region branch reads so the test
// asserts hook behaviour (does onKycSuccess fire? is an error surfaced?) and nothing else.
// The websocket mock captures the status-update handler so a test can simulate a
// late/stale APPROVED event arriving after the flow has resolved.

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
const selectionPlan = (flow: 'verify-once' | 'document-first') => ({
    available: true,
    activeAttemptId: null,
    policyVersion: 'v1',
    flow,
    features: { qr: true, bank: false, local: false, card: false },
    routes: [],
})

describe('legacy identity selection recovery acceptance', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockInitiate.mockResolvedValue({ error: 'Choose your features', code: 'feature_selection_required' })
        jest.mocked(getKycDocumentStatus).mockResolvedValue('NOT_STARTED')
    })
    it.each(['verify-once', 'document-first'] as const)(
        '%s recovers the selection requirement without another SDK identity attempt',
        async (flow) => {
            const plan = selectionPlan(flow)
            jest.mocked(getKycDocumentPlan)
                .mockResolvedValueOnce({ available: false, routes: [] } as never)
                .mockResolvedValue(plan)
            const onKycSuccess = jest.fn()
            const { result } = renderHook(() => useSumsubKycFlow({ onKycSuccess }))
            await act(async () => {
                await result.current.handleInitiateKyc('NA', undefined, true)
            })
            expect(mockInitiate).toHaveBeenCalledTimes(1)
            if (flow === 'verify-once') {
                expect(mockRouterPush).toHaveBeenCalledWith('/verify?feature=bank')
            } else {
                expect(result.current.error).toBe('Choose your features')
                expect(mockRouterPush).not.toHaveBeenCalled()
            }
            expect(result.current).not.toHaveProperty('documentPlan')
            expect(result.current.showWrapper).toBe(false)
            expect(onKycSuccess).not.toHaveBeenCalled()
            expect(resumeKycDocumentAttempt).not.toHaveBeenCalled()
        }
    )
})
