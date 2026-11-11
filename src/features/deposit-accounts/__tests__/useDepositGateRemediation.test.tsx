/**
 * The gate banner's button has to start the run the gate actually asked for.
 * Every kind used to end in `handleInitiateKyc`, so a user whose identity the
 * provider told us to restart was sent back through the run that produced the
 * block.
 */
import { act, render } from '@testing-library/react'
import { useDepositGateRemediation } from '../useDepositGateRemediation'
import { gateFromEntry, type GateState } from '@/utils/capability-gate'
import { DEPOSIT_RAIL_ORDER } from '../rails'
import type { DepositCorridor } from '../types'
import { USER } from '@/constants/query.consts'
import { DEPOSIT_ACCOUNTS_QUERY_KEY } from '../useDepositAccounts'

const handleInitiateKyc = jest.fn()
const handleRestartIdentity = jest.fn()
const handleSelfHealResubmit = jest.fn()
const handleFixableGate = jest.fn()
let mockShowWrapper = false
let mockFlowOptions: { onActionSubmitted?: (key: string) => void } = {}
const mockToastInfo = jest.fn()
const mockInvalidate = jest.fn()
let mockPostalCorrection: { visible: boolean; onQueued: () => void }
jest.mock('../components/BridgePostalCorrectionModal', () => ({
    BridgePostalCorrectionModal: (props: typeof mockPostalCorrection) => {
        mockPostalCorrection = props
        return null
    },
}))
jest.mock('@/components/0_Bruddle/Toast', () => ({ useToast: () => ({ info: mockToastInfo }) }))
jest.mock('@tanstack/react-query', () => ({
    ...jest.requireActual('@tanstack/react-query'),
    useQueryClient: () => ({ invalidateQueries: mockInvalidate }),
}))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))
jest.mock('@/hooks/useMultiPhaseKycFlow', () => ({
    useMultiPhaseKycFlow: (options: typeof mockFlowOptions) => {
        mockFlowOptions = options
        return {
            handleInitiateKyc: (...args: unknown[]) => handleInitiateKyc(...args),
            handleRestartIdentity: () => handleRestartIdentity(),
            handleSelfHealResubmit: (...args: unknown[]) => handleSelfHealResubmit(...args),
            handleFixableGate: (...args: unknown[]) => handleFixableGate(...args),
            isLoading: false,
            error: null,
            errorCooldown: null,
            showWrapper: mockShowWrapper,
        }
    },
}))
const gateFor = jest.fn((): GateState => ({ kind: 'needs-enrollment' }) as GateState)
jest.mock('@/hooks/useCapabilities', () => ({
    useCapabilities: () => ({ gateFor: (...args: unknown[]) => (gateFor as jest.Mock)(...args) }),
}))
jest.mock('@/hooks/useTosGuard', () => ({
    useTosGuard: () => ({ guardWithTos: jest.fn(), showBridgeTos: false, hideTos: jest.fn() }),
}))
const mockSetIsSupportModalOpen = jest.fn()
const mockOpenSupportWithMessage = jest.fn()
jest.mock('@/context/ModalsContext', () => ({
    useModalsContext: () => ({
        setIsSupportModalOpen: mockSetIsSupportModalOpen,
        openSupportWithMessage: mockOpenSupportWithMessage,
    }),
}))
const mockRouterPush = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockRouterPush }) }))
jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
jest.mock('@/components/Kyc/BridgeTosStep', () => ({ BridgeTosStep: () => null }))
jest.mock('@/components/Kyc/ProvideEmailStep', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Kyc/SumsubKycModals', () => ({ SumsubKycModals: () => null }))

// the modal is the only way to reach onVerify, so the test holds its props
let verify: () => Promise<void>
let modalVisible = false
let modalVerifyEntry: unknown
jest.mock('@/components/Kyc/InitiateKycModal', () => ({
    InitiateKycModal: (props: { visible: boolean; onVerify: () => Promise<void>; verifyEntry?: unknown }) => {
        verify = props.onVerify
        modalVisible = props.visible
        modalVerifyEntry = props.verifyEntry
        return null
    },
}))

type Remediation = ReturnType<typeof useDepositGateRemediation>

const openWith = async (open: (remediation: Remediation) => void) => {
    let remediation: Remediation | undefined
    function Host() {
        remediation = useDepositGateRemediation()
        return <>{remediation.modals}</>
    }
    render(<Host />)
    act(() => open(remediation!))
    await act(async () => {
        await verify()
    })
}

const openBannerFor = (gate: GateState, corridor?: DepositCorridor) =>
    openWith((remediation) => remediation.resolveGate(gate, corridor))

beforeEach(() => {
    jest.clearAllMocks()
    mockShowWrapper = false
})

describe('useDepositGateRemediation', () => {
    it('refreshes the user gate and deposit accounts after a Bridge postal correction', () => {
        let remediation: Remediation | undefined
        function Host() {
            remediation = useDepositGateRemediation()
            return <>{remediation.modals}</>
        }
        render(<Host />)
        const gate = gateFromEntry(
            { state: 'action_required', reason: 'invalid_bank_postal_code', action: 'contact-support' },
            {
                rails: [],
                nextActions: [{ key: 'contact-support', kind: 'contact-support', purpose: 'invalid_bank_postal_code' }],
            }
        )
        act(() => remediation!.resolveGate(gate, 'ACH_US'))
        expect(mockPostalCorrection.visible).toBe(true)
        expect(mockInvalidate).not.toHaveBeenCalled()
        act(() => mockPostalCorrection.onQueued())
        expect(mockInvalidate.mock.calls).toEqual([[{ queryKey: [USER] }], [{ queryKey: DEPOSIT_ACCOUNTS_QUERY_KEY }]])
    })

    it('restarts the identity run the provider asked us to restart', async () => {
        await openBannerFor({ kind: 'restart-identity' } as GateState)

        expect(handleRestartIdentity).toHaveBeenCalled()
        expect(handleInitiateKyc).not.toHaveBeenCalled()
    })

    // The report entry the API sends for a rail whose provider asks for a new ID, through the real gate mapping.
    it.each(['id_expired', 'id_verification_failed', 'identity_verification_required'])(
        'a provider asking for a new ID (%s) opens the identity restart, never a resubmit',
        async (reason) => {
            const restart = { key: 'restart-identity', kind: 'restart-identity' as const, purpose: reason }
            const gate = gateFromEntry(
                { state: 'action_required', reason, action: restart.key },
                { rails: [], nextActions: [restart] }
            )
            expect(gate).toMatchObject({ kind: 'restart-identity', reason: { code: reason } })
            await openBannerFor(gate, 'SEPA_EU')

            expect(handleRestartIdentity).toHaveBeenCalled()
            expect(handleFixableGate).not.toHaveBeenCalled()
            expect(handleSelfHealResubmit).not.toHaveBeenCalled()
            expect(handleInitiateKyc).not.toHaveBeenCalled()
        }
    )

    it('hands a fixable rejection to the shared router rather than collecting it again', async () => {
        const gate = { kind: 'fixable-rejection' } as GateState
        await openBannerFor(gate)

        expect(handleFixableGate).toHaveBeenCalledWith('BRIDGE', gate)
        expect(handleInitiateKyc).not.toHaveBeenCalled()
    })

    // A supplement has no provider rejection behind it, so the resubmit route 404s.
    it('passes a parked rail its supplement action, never straight to resubmit', async () => {
        const gate = {
            kind: 'fixable-rejection',
            userMessage: null,
            actionKey: 'supplement:bridge',
            reason: { code: 'requirements_missing', userMessage: 'x' },
        } as GateState
        await openBannerFor(gate, 'SEPA_EU')

        expect(handleFixableGate).toHaveBeenCalledWith('BRIDGE', gate)
        expect(handleSelfHealResubmit).not.toHaveBeenCalled()
    })

    it("sends Bridge's hosted check to its own screen, not to a resubmit", async () => {
        const gate = {
            kind: 'fixable-rejection',
            userMessage: null,
            nextAction: { key: 'bridge-hosted', kind: 'bridge-hosted', purpose: 'bridge-additional-verification' },
        } as GateState
        await openBannerFor(gate, 'SEPA_EU')

        expect(mockRouterPush).toHaveBeenCalledWith('/profile/accounts/additional')
        expect(handleFixableGate).not.toHaveBeenCalled()
        expect(handleInitiateKyc).not.toHaveBeenCalled()
    })

    it('opens support for a duplicate account with a message naming the case', () => {
        let remediation: Remediation | undefined
        function Host() {
            remediation = useDepositGateRemediation()
            return <>{remediation.modals}</>
        }
        render(<Host />)
        act(() =>
            remediation!.resolveGate({
                kind: 'blocked-rejection',
                userMessage: null,
                reason: { code: 'duplicate_account', userMessage: '' },
            })
        )

        expect(mockOpenSupportWithMessage).toHaveBeenCalledWith(expect.stringContaining('reason: duplicate_account'))
        expect(mockSetIsSupportModalOpen).not.toHaveBeenCalled()
    })

    it("names the corridor's own provider", async () => {
        const gate = { kind: 'fixable-rejection', actionKey: 'sumsub:source_of_funds' } as GateState
        await openBannerFor(gate, 'PIX_BR')

        expect(handleFixableGate).toHaveBeenCalledWith('MANTECA', gate)
    })

    // a verify-once user leaves for /verify from the modal itself, before it paints
    it('names the corridor to the start modal, so a verify-once user goes straight to /verify', async () => {
        await openBannerFor({ kind: 'needs-identity' } as GateState, 'PIX_BR')
        expect(modalVerifyEntry).toEqual({ corridor: 'PIX_BR' })
    })

    it('starts a first identity run for a user who has none', async () => {
        await openBannerFor({ kind: 'needs-identity' } as GateState)

        expect(handleInitiateKyc).toHaveBeenCalled()
    })

    it('closes the start modal when the SDK opens', () => {
        let remediation: Remediation | undefined
        function Host() {
            remediation = useDepositGateRemediation()
            return <>{remediation.modals}</>
        }
        const { rerender } = render(<Host />)
        act(() => remediation!.resolveGate({ kind: 'needs-identity' } as GateState))
        expect(modalVisible).toBe(true)
        mockShowWrapper = true
        rerender(<Host />)
        expect(modalVisible).toBe(false)
    })

    // One path from a corridor tap into verification, whichever screen the tap
    // came from: the corridor goes to the backend, which opens its level.
    it.each(DEPOSIT_RAIL_ORDER)('sends %s to verification as the corridor it is', async (corridor) => {
        await openBannerFor({ kind: 'needs-enrollment' } as GateState, corridor)

        expect(handleInitiateKyc).toHaveBeenCalledWith(undefined, undefined, true, undefined, corridor)
    })

    it('starts an unverified user on the corridor level, not as a cross-region upgrade', async () => {
        await openBannerFor({ kind: 'needs-identity' } as GateState, 'BANK_TRANSFER_CO')

        expect(handleInitiateKyc).toHaveBeenCalledWith(undefined, undefined, undefined, undefined, 'BANK_TRANSFER_CO')
    })

    it('a claim that answered verification_required starts the same run, from the corridor gate', async () => {
        await openWith((remediation) => remediation.verifyCorridor('BANK_TRANSFER_CO'))

        expect(gateFor).toHaveBeenCalledWith('deposit', { railId: 'bridge.bank_transfer_co' })
        expect(handleInitiateKyc).toHaveBeenCalledWith(undefined, undefined, true, undefined, 'BANK_TRANSFER_CO')
    })

    it('opens the explicit SEPA identity restart despite a stale ready gate and waits for confirmation', async () => {
        gateFor.mockReturnValueOnce({ kind: 'ready' })
        let remediation: Remediation | undefined
        function Host() {
            remediation = useDepositGateRemediation()
            return <>{remediation.modals}</>
        }
        render(<Host />)
        const nextAction = {
            key: 'restart-identity',
            kind: 'restart-identity' as const,
            purpose: 'identity_document_insufficient',
        }
        act(() => remediation!.verifyCorridor('SEPA_EU', nextAction))

        expect(modalVisible).toBe(true)
        expect(handleRestartIdentity).not.toHaveBeenCalled()
        await act(async () => verify())
        expect(handleRestartIdentity).toHaveBeenCalledTimes(1)
        expect(handleInitiateKyc).not.toHaveBeenCalled()
    })

    it('does not let an older claim restart identity after a terminal hold is known', async () => {
        let remediation: Remediation | undefined
        function Host() {
            remediation = useDepositGateRemediation()
            return <>{remediation.modals}</>
        }
        render(<Host />)
        const nextAction = {
            key: 'restart-identity',
            kind: 'restart-identity' as const,
            purpose: 'identity_document_insufficient',
        }
        gateFor.mockReturnValueOnce({ kind: 'ready' })
        act(() => remediation!.verifyCorridor('SEPA_EU', nextAction))
        expect(modalVisible).toBe(true)

        gateFor.mockReturnValueOnce({
            kind: 'blocked-rejection',
            userMessage: null,
            reason: { code: 'duplicate_account', userMessage: '' },
        })
        await act(async () => verify())
        expect(modalVisible).toBe(false)
        expect(handleRestartIdentity).not.toHaveBeenCalled()
        expect(mockOpenSupportWithMessage).toHaveBeenCalledTimes(1)
    })
})

/** TASK-24662: the drawer explained the address step, so its button opens it with no modal in front. */
describe('the address step', () => {
    const capture = (jest.requireMock('posthog-js') as { default: { capture: jest.Mock } }).default.capture
    const addressGate: GateState = {
        kind: 'fixable-rejection',
        userMessage: null,
        reason: { code: 'residence_unresolved', userMessage: '' },
        actionKey: 'sumsub:address_of_residence',
        nextAction: {
            key: 'sumsub:address_of_residence',
            kind: 'sumsub',
            purpose: 'residence_address_required',
            levelKey: 'address_of_residence',
        },
    }

    it('starts the bound action straight away', async () => {
        let remediation: Remediation | undefined
        function Host() {
            remediation = useDepositGateRemediation()
            return <>{remediation.modals}</>
        }
        render(<Host />)
        await act(async () => remediation!.resolveGate(addressGate, 'ACH_US'))
        expect(handleFixableGate).toHaveBeenCalledWith('BRIDGE', addressGate)
        expect(modalVisible).toBe(false)
    })

    it('on submission says it was sent, reports it for the corridor, and reads the corridors again', async () => {
        let remediation: Remediation | undefined
        function Host() {
            remediation = useDepositGateRemediation()
            return <>{remediation.modals}</>
        }
        render(<Host />)
        await act(async () => remediation!.resolveGate(addressGate, 'ACH_US'))
        act(() => mockFlowOptions.onActionSubmitted?.('sumsub:address_of_residence'))
        expect(mockToastInfo).toHaveBeenCalledWith('gate.addressSent')
        expect(capture).toHaveBeenCalledWith('deposit_account_address_step_submitted', { corridor: 'ACH_US' })
        expect(mockInvalidate).toHaveBeenCalledWith({ queryKey: ['deposit-accounts'] })
    })

    it('ignores other actions’ submissions', () => {
        function Host() {
            useDepositGateRemediation()
            return null
        }
        render(<Host />)
        act(() => mockFlowOptions.onActionSubmitted?.('supplement:bridge'))
        expect(mockToastInfo).not.toHaveBeenCalled()
    })
})
