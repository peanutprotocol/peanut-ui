/**
 * The gate banner's button has to start the run the gate actually asked for.
 * Every kind used to end in `handleInitiateKyc`, so a user whose identity the
 * provider told us to restart was sent back through the run that produced the
 * block.
 */
import { act, fireEvent, render, screen } from '@testing-library/react'
import { useDepositGateRemediation } from '../useDepositGateRemediation'
import { type GateState } from '@/utils/capability-gate'

const handleInitiateKyc = jest.fn()
const handleRestartIdentity = jest.fn()
const handleSelfHealResubmit = jest.fn()
const handleFixableGate = jest.fn()
let mockShowWrapper = false
let mockLoading = false
let mockError: string | null = null
type FlowOptions = { onActionSubmitted?: (key: string) => void }
const mockToastInfo = jest.fn()
const mockInvalidate = jest.fn()
jest.mock('@/components/0_Bruddle/Toast', () => ({ useToast: () => ({ info: mockToastInfo }) }))
jest.mock('@tanstack/react-query', () => ({
    ...jest.requireActual('@tanstack/react-query'),
    useQueryClient: () => ({ invalidateQueries: mockInvalidate }),
}))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))
jest.mock('@/hooks/useMultiPhaseKycFlow', () => ({
    useMultiPhaseKycFlow: (_options: FlowOptions) => {
        return {
            handleInitiateKyc: (...args: unknown[]) => handleInitiateKyc(...args),
            handleRestartIdentity: () => handleRestartIdentity(),
            handleSelfHealResubmit: (...args: unknown[]) => handleSelfHealResubmit(...args),
            handleFixableGate: (...args: unknown[]) => handleFixableGate(...args),
            handleSdkClose: mockSdkClose,
            isLoading: mockLoading,
            error: mockError,
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
    useModalsContextOptional: () => null,
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
jest.mock('@/components/Kyc/SumsubKycModals', () => ({
    SumsubKycModals: () => (mockShowWrapper ? <div data-testid="sdk-wrapper" /> : null),
}))

jest.mock('@/components/Kyc/InitiateKycModal', () => ({
    InitiateKycModal: () => null,
}))

type Remediation = ReturnType<typeof useDepositGateRemediation>
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

function mountRemediation() {
    let current: Remediation
    function Host() {
        current = useDepositGateRemediation()
        return <>{current.modals}</>
    }
    const view = render(<Host />)
    return { ...view, current: () => current!, refresh: () => view.rerender(<Host />) }
}

beforeEach(() => {
    jest.clearAllMocks()
    handleFixableGate.mockReset()
    mockShowWrapper = false
    mockLoading = false
    mockError = null
})

const mockSdkClose = jest.fn()
let mockOwner = 'A'
jest.mock('@/context/authContext', () => ({ useOptionalAuth: () => ({ user: { user: { userId: mockOwner } } }) }))
jest.mock('../components/AddressLaunchModal', () => ({
    AddressLaunchModal: (props: any) =>
        props.visible ? (
            <div data-testid="launch">
                {props.loading ? <div role="status">pending</div> : <div role="alert">{props.error}</div>}
                <button onClick={props.onClose}>dismiss</button>
                <button onClick={props.onRetry}>retry</button>
            </div>
        ) : null,
}))
beforeEach(() => {
    mockOwner = 'A'
})
it('verifier: dismissal ignores late rejection and allows a new independent start', async () => {
    let rejectOld!: (e: Error) => void
    handleFixableGate.mockImplementationOnce(
        () =>
            new Promise((_r, reject) => {
                rejectOld = reject
            })
    )
    const view = mountRemediation()
    act(() => view.current().resolveGate(addressGate, 'ACH_US'))
    expect(screen.getByRole('status')).toBeVisible()
    act(() => fireEvent.click(screen.getByText('dismiss')))
    expect(mockSdkClose).toHaveBeenCalledTimes(1)
    expect(screen.queryByTestId('launch')).not.toBeInTheDocument()
    await act(async () => {
        rejectOld(new Error('old failure'))
    })
    expect(screen.queryByTestId('launch')).not.toBeInTheDocument()
    handleFixableGate.mockImplementationOnce(() => new Promise(() => {}))
    act(() => view.current().resolveGate(addressGate, 'ACH_US'))
    expect(screen.getByRole('status')).toBeVisible()
    expect(handleFixableGate).toHaveBeenCalledTimes(2)
})
it('verifier: late A failure cannot clear or replace B pending launch', async () => {
    let rejectA!: (e: Error) => void
    let rejectB!: (e: Error) => void
    handleFixableGate.mockImplementationOnce(
        () =>
            new Promise((_r, reject) => {
                rejectA = reject
            })
    )
    const view = mountRemediation()
    act(() => view.current().resolveGate(addressGate, 'ACH_US'))
    const staleResolve = view.current().resolveGate
    mockOwner = 'B'
    view.refresh()
    expect(screen.queryByTestId('launch')).not.toBeInTheDocument()
    act(() => staleResolve(addressGate, 'ACH_US'))
    expect(handleFixableGate).toHaveBeenCalledTimes(1)
    handleFixableGate.mockImplementationOnce(
        () =>
            new Promise((_r, reject) => {
                rejectB = reject
            })
    )
    act(() => view.current().resolveGate(addressGate, 'ACH_US'))
    await act(async () => {
        rejectA(new Error('A failure'))
    })
    expect(screen.getByRole('status')).toBeVisible()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    await act(async () => {
        rejectB(new Error('B failure'))
    })
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('gate.actFailed')
    expect(handleFixableGate).toHaveBeenCalledTimes(2)
})
