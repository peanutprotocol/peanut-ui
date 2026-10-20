jest.mock('@/utils/native-platform', () => require('@/test-utils/native-platform-mock').createNativePlatformMock())

import {
    getKycDocumentStatus,
    getKycDocumentPlan,
    startKycDocumentAttempt,
    saveKycFeatures,
} from '@/app/actions/kyc-workflow'
import { serverFetch } from '@/utils/api-fetch'
jest.mock('@/utils/api-fetch', () => ({ serverFetch: jest.fn() }))
import { act } from '@testing-library/react'
import { renderHookWithIntl as renderHook } from '@/test-utils/intl'
import { useSumsubKycFlow } from '@/hooks/useSumsubKycFlow'
import { initiateSumsubKyc } from '@/app/actions/sumsub'

jest.mock('@/app/actions/kyc-workflow', () => {
    const getKycDocumentPlan = jest.fn(async (_restart?: boolean) => ({ available: false, routes: [] }))
    return {
        getKycDocumentStatus: jest.fn(async () => 'IN_REVIEW'),
        getKycDocumentPlan,
        findKycDocumentPlan: jest.fn((restart?: boolean) => getKycDocumentPlan(restart).catch(() => null)),
        resumeKycDocumentAttempt: jest.fn(),
        startKycDocumentAttempt: jest.fn(),
        startKycDocumentReplacement: jest.fn(),
        saveKycFeatures: jest.fn(),
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
let mockVerifyOnceFlag = false
jest.mock('@/features/verify-once/verifyOnceFlag', () => ({
    isVerifyOnceEnabled: () => mockVerifyOnceFlag,
    verifyOnceHeaders: () => ({}),
}))
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
        mockVerifyOnceFlag = true
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
                expect(result.current.documentPreferencesOnly).toBe(true)
                expect(result.current.documentPlan).toEqual(plan)
                expect(mockRouterPush).not.toHaveBeenCalled()
            }
            expect(result.current.showWrapper).toBe(false)
            expect(onKycSuccess).not.toHaveBeenCalled()
            expect(startKycDocumentAttempt).not.toHaveBeenCalled()
        }
    )
})

describe('added feature questions routing acceptance', () => {
    it.each(['bank', 'card', 'local'] as const)(
        'routes missing %s answers to its feature-scoped verify screen',
        async (feature) => {
            jest.clearAllMocks()
            mockVerifyOnceFlag = false
            const plan = selectionPlan('document-first')
            jest.mocked(getKycDocumentPlan)
                .mockResolvedValueOnce({ ...plan, available: false })
                .mockResolvedValue(plan)
            jest.mocked(getKycDocumentStatus).mockResolvedValue('APPROVED')
            jest.mocked(saveKycFeatures).mockImplementation(
                jest.requireActual('@/app/actions/kyc-workflow').saveKycFeatures
            )
            jest.mocked(serverFetch).mockResolvedValue({
                ok: false,
                status: 409,
                json: async () => ({ code: 'questions_missing', feature, step: 'work' }),
            } as Response)
            const onKycSuccess = jest.fn()
            const { result } = renderHook(() => useSumsubKycFlow({ onKycSuccess }))
            await act(async () => {
                await result.current.handleInitiateKyc()
            })
            expect(result.current.documentPreferencesOnly).toBe(true)
            await act(async () => {
                await result.current.confirmDocumentPlan('', [], { ...plan.features, [feature]: true })
            })
            expect(mockRouterPush).toHaveBeenCalledWith(`/verify?feature=${feature}`)
            expect(onKycSuccess).not.toHaveBeenCalled()
            expect(result.current.showWrapper).toBe(false)
        }
    )
})
