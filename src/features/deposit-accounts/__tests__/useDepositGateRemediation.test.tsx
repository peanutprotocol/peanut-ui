/**
 * The gate banner's button has to start the run the gate actually asked for.
 * Every kind used to end in `handleInitiateKyc`, so a user whose identity the
 * provider told us to restart was sent back through the run that produced the
 * block.
 */
import { act, render } from '@testing-library/react'
import { useDepositGateRemediation } from '../useDepositGateRemediation'
import type { GateState } from '@/utils/capability-gate'
import { DEPOSIT_RAIL_ORDER } from '../rails'
import type { DepositCorridor } from '../types'

const handleInitiateKyc = jest.fn()
const handleRestartIdentity = jest.fn()
const handleSelfHealResubmit = jest.fn()
const handleFixableGate = jest.fn()
let mockShowWrapper = false
jest.mock('@/hooks/useMultiPhaseKycFlow', () => ({
    useMultiPhaseKycFlow: () => ({
        handleInitiateKyc: (...args: unknown[]) => handleInitiateKyc(...args),
        handleRestartIdentity: () => handleRestartIdentity(),
        handleSelfHealResubmit: (...args: unknown[]) => handleSelfHealResubmit(...args),
        handleFixableGate: (...args: unknown[]) => handleFixableGate(...args),
        isLoading: false,
        error: null,
        errorCooldown: null,
        showWrapper: mockShowWrapper,
    }),
}))
const gateFor = jest.fn((): GateState => ({ kind: 'needs-enrollment' }) as GateState)
jest.mock('@/hooks/useCapabilities', () => ({
    useCapabilities: () => ({ gateFor: (...args: unknown[]) => (gateFor as jest.Mock)(...args) }),
}))
jest.mock('@/hooks/useTosGuard', () => ({
    useTosGuard: () => ({ guardWithTos: jest.fn(), showBridgeTos: false, hideTos: jest.fn() }),
}))
jest.mock('@/context/ModalsContext', () => ({ useModalsContext: () => ({ setIsSupportModalOpen: jest.fn() }) }))
jest.mock('@/components/Kyc/BridgeTosStep', () => ({ BridgeTosStep: () => null }))
jest.mock('@/components/Kyc/ProvideEmailStep', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Kyc/SumsubKycModals', () => ({ SumsubKycModals: () => null }))

// the modal is the only way to reach onVerify, so the test holds its props
let verify: () => Promise<void>
let modalVisible = false
jest.mock('@/components/Kyc/InitiateKycModal', () => ({
    InitiateKycModal: (props: { visible: boolean; onVerify: () => Promise<void> }) => {
        verify = props.onVerify
        modalVisible = props.visible
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
    it('restarts the identity run the provider asked us to restart', async () => {
        await openBannerFor({ kind: 'restart-identity' } as GateState)

        expect(handleRestartIdentity).toHaveBeenCalled()
        expect(handleInitiateKyc).not.toHaveBeenCalled()
    })

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

    it("names the corridor's own provider", async () => {
        const gate = { kind: 'fixable-rejection', actionKey: 'sumsub:source_of_funds' } as GateState
        await openBannerFor(gate, 'PIX_BR')

        expect(handleFixableGate).toHaveBeenCalledWith('MANTECA', gate)
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
})
