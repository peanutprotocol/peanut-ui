/**
 * One-shot onboarding in the flow hook (TASK-23329, item 9a). The SDK session
 * the unlock checklist started is followed by the setup rows, not the phase
 * modals: no Bridge terms phase, no completion on one bank rail. Every other
 * flow keeps the phases: a user the server did not flag, a tab that holds no
 * stored set, and a later flow of an already approved user.
 */
import { act } from '@testing-library/react'
import { renderHookWithIntl as renderHook } from '@/test-utils/intl'
import { useMultiPhaseKycFlow } from '@/hooks/useMultiPhaseKycFlow'
import { initiateSumsubKyc } from '@/app/actions/sumsub'
import {
    __resetOneShotSessionForTests,
    markOneShotStarted,
    recordOneShotIntents,
    useOneShotSession,
} from '@/hooks/useOneShotSession'
import type { UserCapabilities } from '@/types/capabilities'

const mockWs: { handler?: (status: string, labels?: string[]) => void } = {}
const mockFetchUser = jest.fn()
// what /users/me holds; the tests move it the way the API would
const mockUser: Record<string, unknown> = { user: { username: 'test' } }
let mockCapabilities: UserCapabilities | undefined
// what the bank gate answers; 'accept-tos' is the state that opens the Bridge terms phase
let mockGateKind = 'none'

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
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn(), replace: jest.fn() }) }))
jest.mock('@/utils/capacitor', () => ({ isCapacitor: () => false, isAndroidNative: () => false }))
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ fetchUser: mockFetchUser, user: mockUser }) }))
jest.mock('@/hooks/useCapabilities', () => ({ useCapabilities: () => ({ capabilities: mockCapabilities }) }))
jest.mock('@/hooks/useSumsubReloadResume', () => ({ useSumsubReloadResume: jest.fn() }))
jest.mock('@/hooks/useSubmissionWindow', () => ({ markSubmitted: jest.fn() }))
jest.mock('@/utils/capability-gate', () => ({
    ...jest.requireActual('@/utils/capability-gate'),
    deriveGate: () => ({ kind: mockGateKind }),
}))
jest.mock('@/app/actions/users', () => ({ getBridgeTosLink: jest.fn(), confirmBridgeTos: jest.fn() }))

const mockInitiate = initiateSumsubKyc as jest.MockedFunction<typeof initiateSumsubKyc>

const BR_INTENTS = { qr: true, local: true, card: false, bank: false }

// the pool Pix rail: it pays from approval, the first-party account follows
const brazil = (deposit: 'pending' | 'enabled'): UserCapabilities => ({
    rails: [
        {
            id: 'manteca.pix_br',
            provider: 'manteca',
            method: 'PIX_BR',
            channel: 'bank',
            country: 'BR',
            currency: 'BRL',
            status: deposit,
            operations: { pay: 'enabled', deposit, withdraw: deposit },
        },
    ],
    nextActions: [],
    restrictions: [],
})

// the item 3 answer: a token for the one-shot level, which is standalone
const tokenAnswer = {
    data: {
        token: 'tok-one-shot',
        applicantId: 'applicant-one-shot',
        status: 'NOT_STARTED' as const,
        workflow: { regionIntent: 'LATAM' as const, isMultiLevel: false },
    },
}

function setUser(status: 'not_started' | 'verified', oneShot: boolean, capabilities?: UserCapabilities) {
    mockUser.identityVerification = { status, oneShot }
    mockUser.residence = { declared: 'BR', verified: null }
    mockCapabilities = capabilities
    mockFetchUser.mockResolvedValue({ capabilities })
}

const states = (flow: ReturnType<typeof useMultiPhaseKycFlow>) => flow.oneShotSetup?.rows.map((row) => row.state)

/** Start from the checklist's stored set, open the SDK and submit. */
async function submitFromChecklist(onKycSuccess?: () => void) {
    recordOneShotIntents(BR_INTENTS)
    mockInitiate.mockResolvedValue(tokenAnswer)
    const view = renderHook(() => useMultiPhaseKycFlow({ onKycSuccess }))
    await act(async () => {
        await view.result.current.handleInitiateKyc()
    })
    act(() => view.result.current.handleSdkComplete())
    return view
}

describe('useMultiPhaseKycFlow — one-shot onboarding', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        __resetOneShotSessionForTests()
        mockGateKind = 'none'
        mockWs.handler = undefined
        setUser('not_started', true)
    })

    it('follows the SDK with one row per ticked feature and moves each with the check and its rail', async () => {
        const onKycSuccess = jest.fn()
        const { result, rerender } = await submitFromChecklist(onKycSuccess)

        expect(result.current.isMultiLevel).toBe(false)
        expect(result.current.isModalOpen).toBe(true)
        expect(result.current.oneShotSetup).toEqual({
            residence: 'BR',
            rows: [
                { key: 'qr', state: 'under-review' },
                { key: 'local', state: 'under-review' },
            ],
        })

        // approved: QR pays at once, the account is still being opened
        setUser('verified', true, brazil('pending'))
        await act(async () => {
            mockWs.handler?.('APPROVED')
        })
        expect(states(result.current)).toEqual(['available', 'setting-up'])
        expect(result.current.isModalOpen).toBe(true)
        expect(onKycSuccess).not.toHaveBeenCalled()

        // the poller sees the account: every row is available, and Continue completes
        setUser('verified', true, brazil('enabled'))
        rerender()
        expect(states(result.current)).toEqual(['available', 'available'])
        expect(onKycSuccess).not.toHaveBeenCalled()
        act(() => result.current.completeFlow())
        expect(onKycSuccess).toHaveBeenCalledTimes(1)
        expect(result.current.isModalOpen).toBe(false)
        // the flow is over: this hook is back on the phases
        expect(result.current.oneShotSetup).toBeNull()
    })

    // The start of an approved user answers inside the request, before any
    // render. In the same mounted hook that used to take the drawer's branch
    // and leave the progress modal open with nothing to show.
    it('a later start in the same hook takes the phases, with the setup drawer still open', async () => {
        const onKycSuccess = jest.fn()
        const { result } = await submitFromChecklist(onKycSuccess)
        setUser('verified', true, brazil('enabled'))
        await act(async () => {
            mockWs.handler?.('APPROVED')
        })
        expect(result.current.oneShotSetup).not.toBeNull()
        expect(result.current.isModalOpen).toBe(true)
        expect(onKycSuccess).not.toHaveBeenCalled()

        mockInitiate.mockResolvedValue({ data: { token: null, applicantId: 'app', status: 'APPROVED' } })
        await act(async () => {
            await result.current.handleInitiateKyc('LATAM')
        })
        // settled rails complete the flow, as for anyone already approved
        expect(onKycSuccess).toHaveBeenCalledTimes(1)
        expect(result.current.oneShotSetup).toBeNull()
        expect(result.current.isModalOpen).toBe(false)
        expect(result.current.modalPhase).toBe('verifying')
    })

    it('never opens the Bridge terms phase, where the same answer sends everyone else there', async () => {
        mockGateKind = 'accept-tos'

        const oneShot = await submitFromChecklist()
        setUser('verified', true, brazil('pending'))
        await act(async () => {
            mockWs.handler?.('APPROVED')
        })
        expect(oneShot.result.current.modalPhase).toBe('verifying')
        expect(oneShot.result.current.oneShotSetup).not.toBeNull()
        oneShot.unmount()

        __resetOneShotSessionForTests()
        setUser('not_started', false)
        mockInitiate.mockResolvedValue({ data: { token: 'tok', applicantId: 'app', status: 'PENDING' } })
        const legacy = renderHook(() => useMultiPhaseKycFlow({}))
        await act(async () => {
            await legacy.result.current.handleInitiateKyc('LATAM')
        })
        act(() => legacy.result.current.handleSdkComplete())
        setUser('verified', false, brazil('pending'))
        await act(async () => {
            mockWs.handler?.('APPROVED')
        })
        expect(legacy.result.current.modalPhase).toBe('bridge_tos')
        expect(legacy.result.current.oneShotSetup).toBeNull()
    })

    it('stays open when a reviewer takes the check, and closes on a rejection as the progress modal does', async () => {
        const { result } = await submitFromChecklist()
        await act(async () => {
            mockWs.handler?.('IN_REVIEW')
        })
        expect(result.current.isModalOpen).toBe(true)
        expect(states(result.current)).toEqual(['under-review', 'under-review'])

        await act(async () => {
            mockWs.handler?.('ACTION_REQUIRED')
        })
        expect(result.current.isModalOpen).toBe(false)
    })

    it('a dismissed drawer does not come back when a reviewer takes the check', async () => {
        const { result } = await submitFromChecklist()
        act(() => result.current.handleModalClose())
        expect(result.current.isModalOpen).toBe(false)
        await act(async () => {
            mockWs.handler?.('IN_REVIEW')
        })
        expect(result.current.isModalOpen).toBe(false)
    })

    it('an interrupted session resumes with the same request and keeps its stored set', async () => {
        recordOneShotIntents(BR_INTENTS)
        mockInitiate.mockResolvedValue(tokenAnswer)
        const { result } = renderHook(() => ({ flow: useMultiPhaseKycFlow({}), session: useOneShotSession() }))
        expect(result.current.session).toEqual({ intents: BR_INTENTS, started: false })

        await act(async () => {
            await result.current.flow.handleInitiateKyc()
        })
        expect(result.current.flow.showWrapper).toBe(true)
        expect(result.current.session).toEqual({ intents: BR_INTENTS, started: true })

        // closed halfway: nothing was submitted, so no setup drawer
        act(() => result.current.flow.handleSdkClose())
        expect(result.current.flow.showWrapper).toBe(false)
        expect(result.current.flow.isModalOpen).toBe(false)
        expect(result.current.session).toEqual({ intents: BR_INTENTS, started: true })

        await act(async () => {
            await result.current.flow.handleInitiateKyc()
        })
        expect(result.current.flow.showWrapper).toBe(true)
        expect(mockInitiate).toHaveBeenCalledTimes(2)
        expect(mockInitiate.mock.calls[1]).toEqual(mockInitiate.mock.calls[0])

        act(() => result.current.flow.handleSdkComplete())
        expect(states(result.current.flow)).toEqual(['under-review', 'under-review'])
    })
})

describe('useMultiPhaseKycFlow — flows that keep the phases', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        __resetOneShotSessionForTests()
        mockGateKind = 'none'
        mockWs.handler = undefined
    })

    const runLegacyToApproval = async (onKycSuccess: () => void) => {
        mockInitiate.mockResolvedValue({ data: { token: 'tok', applicantId: 'app', status: 'PENDING' } })
        const view = renderHook(() => ({ flow: useMultiPhaseKycFlow({ onKycSuccess }), session: useOneShotSession() }))
        await act(async () => {
            await view.result.current.flow.handleInitiateKyc('LATAM')
        })
        act(() => view.result.current.flow.handleSdkComplete())
        expect(view.result.current.flow.modalPhase).toBe('verifying')
        expect(view.result.current.flow.oneShotSetup).toBeNull()
        return view
    }

    it('a user the server did not flag: settled rails on approval complete the flow, and a stored set is never read', async () => {
        setUser('not_started', false)
        recordOneShotIntents(BR_INTENTS) // cannot happen for them; proves the flag gates the store too
        const onKycSuccess = jest.fn()
        const { result } = await runLegacyToApproval(onKycSuccess)

        setUser('verified', false, brazil('enabled'))
        await act(async () => {
            mockWs.handler?.('APPROVED')
        })
        expect(onKycSuccess).toHaveBeenCalledTimes(1)
        expect(result.current.flow.oneShotSetup).toBeNull()
        expect(result.current.session).toEqual({ intents: BR_INTENTS, started: false })
    })

    it('a user the server did not flag: a reviewer taking the check closes the progress modal, as before', async () => {
        setUser('not_started', false)
        const { result } = await runLegacyToApproval(jest.fn())
        expect(result.current.flow.isModalOpen).toBe(true)
        await act(async () => {
            mockWs.handler?.('IN_REVIEW')
        })
        expect(result.current.flow.isModalOpen).toBe(false)
    })

    it('a flagged user in a tab with no stored set (a reload): the phases run to completion', async () => {
        setUser('not_started', true)
        const onKycSuccess = jest.fn()
        const { result } = await runLegacyToApproval(onKycSuccess)

        setUser('verified', true, brazil('enabled'))
        await act(async () => {
            mockWs.handler?.('APPROVED')
        })
        expect(onKycSuccess).toHaveBeenCalledTimes(1)
        expect(result.current.flow.oneShotSetup).toBeNull()
    })

    it('an approved one-shot user starting a later flow gets no token and completes as before', async () => {
        setUser('verified', true, brazil('enabled'))
        recordOneShotIntents(BR_INTENTS)
        markOneShotStarted()
        mockInitiate.mockResolvedValue({ data: { token: null, applicantId: 'app', status: 'APPROVED' } })
        const onKycSuccess = jest.fn()
        const { result } = renderHook(() => useMultiPhaseKycFlow({ onKycSuccess }))

        await act(async () => {
            await result.current.handleInitiateKyc('LATAM')
        })
        expect(onKycSuccess).toHaveBeenCalledTimes(1)
        expect(result.current.oneShotSetup).toBeNull()
        expect(result.current.isModalOpen).toBe(false)
    })
})
