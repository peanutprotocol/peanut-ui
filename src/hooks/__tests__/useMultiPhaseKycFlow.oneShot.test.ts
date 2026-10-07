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
import posthog from 'posthog-js'
import { initiateSumsubKyc, restartIdentityVerification } from '@/app/actions/sumsub'
import { markSubmitted } from '@/hooks/useSubmissionWindow'
import type { FeatureSetupReport } from '@/services/kyc-intents'
import { rainApi } from '@/services/rain'
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
// the card step (item 9b): POST /rain/cards and the readiness poll after the questions
jest.mock('@/services/rain', () => ({ rainApi: { applyForCard: jest.fn(), getCardApplyReadiness: jest.fn() } }))
jest.mock('@/components/Card/cardApply.utils', () => ({ pollUntilReady: jest.fn(), pollUntilApplyAdvances: jest.fn() }))

const mockInitiate = initiateSumsubKyc as jest.MockedFunction<typeof initiateSumsubKyc>
const mockRestart = restartIdentityVerification as jest.MockedFunction<typeof restartIdentityVerification>
const mockApply = rainApi.applyForCard as jest.MockedFunction<typeof rainApi.applyForCard>

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
    // a status change keeps the stored set, as /users/me does
    const { kycIntents } = (mockUser.identityVerification ?? {}) as { kycIntents?: typeof BR_INTENTS }
    mockUser.identityVerification = { status, oneShot, ...(kycIntents ? { kycIntents } : {}) }
    mockUser.residence = { declared: 'BR', verified: null }
    mockCapabilities = capabilities
    mockFetchUser.mockResolvedValue({ capabilities })
}

/** The stored set as /users/me carries it after a save (item 3b): the one set the app reads. */
function storeIntents(intents: typeof BR_INTENTS) {
    mockUser.identityVerification = { ...(mockUser.identityVerification as object), kycIntents: intents }
}

const states = (flow: ReturnType<typeof useMultiPhaseKycFlow>) => flow.oneShotSetup?.rows.map((row) => row.state)

/** Start from the checklist's stored set, open the SDK and submit. */
async function submitFromChecklist(onKycSuccess?: () => void) {
    storeIntents(BR_INTENTS)
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
        delete mockUser.identityVerification
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

        delete mockUser.identityVerification
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

    it('stays open when a reviewer takes the check or wants a photo again, and closes on a rejection', async () => {
        const { result } = await submitFromChecklist()
        await act(async () => {
            mockWs.handler?.('IN_REVIEW')
        })
        expect(result.current.isModalOpen).toBe(true)
        expect(result.current.oneShotRetake).toBe(false)
        expect(states(result.current)).toEqual(['under-review', 'under-review'])

        // one photo to retake: the drawer stays, its header offers the retake
        await act(async () => {
            mockWs.handler?.('ACTION_REQUIRED')
        })
        expect(result.current.isModalOpen).toBe(true)
        expect(result.current.oneShotRetake).toBe(true)

        await act(async () => {
            mockWs.handler?.('REJECTED')
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
        storeIntents(BR_INTENTS)
        mockInitiate.mockResolvedValue(tokenAnswer)
        const { result } = renderHook(() => ({ flow: useMultiPhaseKycFlow({}) }))

        await act(async () => {
            await result.current.flow.handleInitiateKyc()
        })
        expect(result.current.flow.showWrapper).toBe(true)

        // closed halfway: nothing was submitted, so no setup drawer
        act(() => result.current.flow.handleSdkClose())
        expect(result.current.flow.showWrapper).toBe(false)
        expect(result.current.flow.isModalOpen).toBe(false)

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
        delete mockUser.identityVerification
        mockGateKind = 'none'
        mockWs.handler = undefined
    })

    const runLegacyToApproval = async (onKycSuccess: () => void) => {
        mockInitiate.mockResolvedValue({ data: { token: 'tok', applicantId: 'app', status: 'PENDING' } })
        const view = renderHook(() => ({ flow: useMultiPhaseKycFlow({ onKycSuccess }) }))
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
        storeIntents(BR_INTENTS) // cannot happen for them; proves the flag gates the store too
        const onKycSuccess = jest.fn()
        const { result } = await runLegacyToApproval(onKycSuccess)

        setUser('verified', false, brazil('enabled'))
        await act(async () => {
            mockWs.handler?.('APPROVED')
        })
        expect(onKycSuccess).toHaveBeenCalledTimes(1)
        expect(result.current.flow.oneShotSetup).toBeNull()
        expect(mockUser.identityVerification).toMatchObject({ kycIntents: BR_INTENTS })
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
        storeIntents(BR_INTENTS)
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

/** Item 9b: the card step runs beside the identity check, from the moment the session closes. */
describe('useMultiPhaseKycFlow — the card step', () => {
    const CARD_INTENTS = { qr: true, local: false, card: true, bank: false }
    const INCOMPLETE = {
        status: 'incomplete' as const,
        missing: [],
        questionnaireComplete: false,
        sumsubAccessToken: 'tok-questions',
    }
    const TERMS = { status: 'terms-required' as const, isUsResident: false, termsVersion: '2026-06-01' }

    beforeEach(() => {
        jest.clearAllMocks()
        delete mockUser.identityVerification
        mockGateKind = 'none'
        mockWs.handler = undefined
        setUser('not_started', true)
    })

    it('starts the card step the moment the identity session closes, and the SDK reopens on the questions', async () => {
        storeIntents(CARD_INTENTS)
        mockInitiate.mockResolvedValue(tokenAnswer)
        mockApply.mockResolvedValue(INCOMPLETE)
        const { result } = renderHook(() => useMultiPhaseKycFlow({}))
        await act(async () => {
            await result.current.handleInitiateKyc()
        })
        expect(mockApply).not.toHaveBeenCalled()
        await act(async () => {
            result.current.handleSdkComplete()
        })
        expect(mockApply).toHaveBeenCalledWith({ termsAccepted: false })
        expect(result.current.oneShotCard.token).toBe('tok-questions')
        expect(result.current.oneShotCard.isForeground).toBe(true)
        expect(states(result.current)).toEqual(['under-review', 'agreements-needed'])
    })

    it('accepted agreements before the approval read setting up on the card row', async () => {
        storeIntents(CARD_INTENTS)
        mockInitiate.mockResolvedValue(tokenAnswer)
        mockApply.mockResolvedValueOnce(TERMS).mockResolvedValueOnce({ status: 'pending-identity', message: 'later' })
        const { result } = renderHook(() => useMultiPhaseKycFlow({}))
        await act(async () => {
            await result.current.handleInitiateKyc()
        })
        await act(async () => {
            result.current.handleSdkComplete()
        })
        expect(result.current.oneShotCard.showTerms).toBe(true)
        await act(() => result.current.oneShotCard.acceptTerms())
        expect(result.current.oneShotCard.isForeground).toBe(false)
        expect(states(result.current)).toEqual(['under-review', 'setting-up'])
    })

    it('reads the stored set from /users/me when the tab holds none, and starts no card step without the tick', async () => {
        mockUser.identityVerification = {
            status: 'not_started',
            oneShot: true,
            kycIntents: { qr: true, local: true, card: false, bank: false },
        }
        mockInitiate.mockResolvedValue(tokenAnswer)
        const { result } = renderHook(() => useMultiPhaseKycFlow({}))
        await act(async () => {
            await result.current.handleInitiateKyc()
        })
        await act(async () => {
            result.current.handleSdkComplete()
        })
        expect(result.current.oneShotSetup?.rows.map((row) => row.key)).toEqual(['qr', 'local'])
        expect(mockApply).not.toHaveBeenCalled()
        expect(result.current.oneShotCard.chain).toBeNull()
    })

    it('the rows follow the set on /users/me', async () => {
        mockUser.identityVerification = {
            status: 'not_started',
            oneShot: true,
            kycIntents: { qr: true, local: false, card: false, bank: true },
        }
        mockInitiate.mockResolvedValue(tokenAnswer)
        const { result } = renderHook(() => useMultiPhaseKycFlow({}))
        await act(async () => {
            await result.current.handleInitiateKyc()
        })
        await act(async () => {
            result.current.handleSdkComplete()
        })
        expect(result.current.oneShotSetup?.rows.map((row) => row.key)).toEqual(['qr', 'bank'])
        expect(mockApply).not.toHaveBeenCalled()
    })

    it('a legacy flow never starts the card step', async () => {
        setUser('not_started', false)
        storeIntents(CARD_INTENTS)
        mockInitiate.mockResolvedValue({ data: { token: 'tok', applicantId: 'app', status: 'PENDING' } })
        const { result } = renderHook(() => useMultiPhaseKycFlow({}))
        await act(async () => {
            await result.current.handleInitiateKyc('LATAM')
        })
        await act(async () => {
            result.current.handleSdkComplete()
        })
        expect(mockApply).not.toHaveBeenCalled()
        expect(result.current.oneShotSetup).toBeNull()
    })
})

/**
 * Item 8c, second part (D16): a verified one-shot user adds a feature from the
 * Unlock tap. No SDK session: the sheet hands the PUT answer to the hook, which
 * shows the setup drawer for the stored set and arms the rail poller.
 */
describe('useMultiPhaseKycFlow — a feature added after the check', () => {
    const report = (bank: FeatureSetupReport['bank']): FeatureSetupReport => ({
        qr: { state: 'on' },
        local: { state: 'not_requested' },
        card: { state: 'not_requested' },
        bank,
    })

    beforeEach(() => {
        jest.clearAllMocks()
        mockGateKind = 'none'
        mockWs.handler = undefined
        setUser('verified', true, brazil('enabled'))
        storeIntents({ qr: true, local: false, card: false, bank: true })
    })

    it('shows the drawer for the stored set, reads the user again and arms the poller', () => {
        const { result } = renderHook(() => useMultiPhaseKycFlow({}))
        expect(result.current.oneShotSetup).toBeNull()

        act(() => result.current.showOneShotSetup(report({ state: 'setting_up' })))
        expect(result.current.isModalOpen).toBe(true)
        expect(result.current.oneShotSetup?.rows).toEqual([
            { key: 'qr', state: 'available' },
            { key: 'bank', state: 'setting-up' },
        ])
        expect(mockFetchUser).toHaveBeenCalledTimes(1)
        expect(markSubmitted).toHaveBeenCalledTimes(1)
        expect(mockInitiate).not.toHaveBeenCalled()
    })

    it('a refusal in the answer fills the row; a pending feature reads setting up', () => {
        const { result } = renderHook(() => useMultiPhaseKycFlow({}))
        act(() => result.current.showOneShotSetup(report({ state: 'refused', reason: 'document_country_unsupported' })))
        expect(states(result.current)).toEqual(['available', 'needs-local-id'])

        act(() => result.current.showOneShotSetup(report({ state: 'pending' })))
        expect(states(result.current)).toEqual(['available', 'setting-up'])
    })

    it('no answer: the rails decide, as after the SDK', () => {
        const { result } = renderHook(() => useMultiPhaseKycFlow({}))
        act(() => result.current.showOneShotSetup(null))
        expect(states(result.current)).toEqual(['available', 'setting-up'])
    })

    it('completing the drawer ends the flow without counting an identity approval', () => {
        const onKycSuccess = jest.fn()
        const { result } = renderHook(() => useMultiPhaseKycFlow({ onKycSuccess }))
        act(() => result.current.showOneShotSetup(report({ state: 'on' })))
        act(() => result.current.completeFlow())
        expect(onKycSuccess).toHaveBeenCalledTimes(1)
        expect(result.current.isModalOpen).toBe(false)
        expect(result.current.oneShotSetup).toBeNull()
        expect(posthog.capture).not.toHaveBeenCalled()
    })

    it('the sheet\'s "verify again" restarts the check as a one-shot flow', async () => {
        mockRestart.mockResolvedValue({
            data: { token: 'tok-restart', levelName: 'one-shot-latam', applicantId: 'app' },
        })
        const { result } = renderHook(() => useMultiPhaseKycFlow({}))
        await act(async () => {
            await result.current.handleOneShotRestart()
        })
        expect(mockRestart).toHaveBeenCalledTimes(1)
        expect(result.current.showWrapper).toBe(true)
        // the drawer follows this session when the SDK closes
        expect(result.current.oneShotSetup).not.toBeNull()
        expect(result.current.isModalOpen).toBe(false)
    })
})
