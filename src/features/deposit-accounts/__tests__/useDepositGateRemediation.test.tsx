/**
 * The gate banner's button has to start the run the gate actually asked for.
 * Every kind used to end in `handleInitiateKyc`, so a user whose identity the
 * provider told us to restart was sent back through the run that produced the
 * block.
 */
import { act, render } from '@testing-library/react'
import { useDepositGateRemediation } from '../useDepositGateRemediation'
import type { GateState } from '@/utils/capability-gate'

const handleInitiateKyc = jest.fn()
const handleRestartIdentity = jest.fn()
const handleSelfHealResubmit = jest.fn()
jest.mock('@/hooks/useMultiPhaseKycFlow', () => ({
    useMultiPhaseKycFlow: () => ({
        handleInitiateKyc: (...args: unknown[]) => handleInitiateKyc(...args),
        handleRestartIdentity: () => handleRestartIdentity(),
        handleSelfHealResubmit: (...args: unknown[]) => handleSelfHealResubmit(...args),
        isLoading: false,
        error: null,
        errorCooldown: null,
        showWrapper: false,
    }),
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
jest.mock('@/components/Kyc/InitiateKycModal', () => ({
    InitiateKycModal: (props: { onVerify: () => Promise<void> }) => {
        verify = props.onVerify
        return null
    },
}))

const openBannerFor = async (gate: GateState) => {
    let resolveGate: (gate: GateState) => void = () => {}
    function Host() {
        const remediation = useDepositGateRemediation()
        resolveGate = remediation.resolveGate
        return <>{remediation.modals}</>
    }
    render(<Host />)
    act(() => resolveGate(gate))
    await act(async () => {
        await verify()
    })
}

beforeEach(() => jest.clearAllMocks())

describe('useDepositGateRemediation', () => {
    it('restarts the identity run the provider asked us to restart', async () => {
        await openBannerFor({ kind: 'restart-identity' } as GateState)

        expect(handleRestartIdentity).toHaveBeenCalled()
        expect(handleInitiateKyc).not.toHaveBeenCalled()
    })

    it('resubmits a rejected document rather than collecting it again', async () => {
        await openBannerFor({ kind: 'fixable-rejection' } as GateState)

        expect(handleSelfHealResubmit).toHaveBeenCalledWith('BRIDGE')
        expect(handleInitiateKyc).not.toHaveBeenCalled()
    })

    it('starts a first identity run for a user who has none', async () => {
        await openBannerFor({ kind: 'needs-identity' } as GateState)

        expect(handleInitiateKyc).toHaveBeenCalled()
    })
})
