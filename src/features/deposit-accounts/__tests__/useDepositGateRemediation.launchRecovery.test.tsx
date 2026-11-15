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

let mockModalVisible = false
jest.mock('@/components/Kyc/InitiateKycModal', () => ({
    InitiateKycModal: ({ visible }: { visible: boolean }) => {
        mockModalVisible = visible
        return null
    },
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
    mockModalVisible = false
})

describe('direct address launch recovery contract', () => {
    it('dispatches immediately once and exposes pending UI while repeated taps are suppressed', async () => {
        let finish!: () => void
        handleFixableGate.mockImplementation(
            () =>
                new Promise<void>((resolve) => {
                    finish = resolve
                })
        )
        const view = mountRemediation()
        act(() => {
            view.current().resolveGate(addressGate, 'ACH_US')
            view.current().resolveGate(addressGate, 'ACH_US')
        })
        mockLoading = true
        view.refresh()
        expect(handleFixableGate).toHaveBeenCalledTimes(1)
        expect(handleFixableGate).toHaveBeenCalledWith('BRIDGE', addressGate)
        expect(mockModalVisible).toBe(false)
        const pending = document.body.querySelector('[role="status"], [role="progressbar"], [aria-busy="true"]')
        expect(pending).toBeVisible()
        await act(async () => finish())
    })

    it.each(['Launch unavailable', 'No access token returned'])(
        'keeps %s visible and retries the same bound gate without starting identity',
        async (failure) => {
            handleFixableGate.mockResolvedValue(undefined)
            const view = mountRemediation()
            await act(async () => view.current().resolveGate(addressGate, 'PIX_BR'))
            mockError = failure
            view.refresh()
            expect(screen.getByText(failure)).toBeVisible()
            expect(mockModalVisible).toBe(false)
            const retry = screen.getByRole('button', { name: /retry|try again/i })
            handleFixableGate.mockImplementation(async () => {
                mockError = null
                mockShowWrapper = true
            })
            await act(async () => fireEvent.click(retry))
            view.refresh()
            expect(handleFixableGate).toHaveBeenCalledTimes(2)
            expect(handleFixableGate.mock.calls).toEqual([
                ['MANTECA', addressGate],
                ['MANTECA', addressGate],
            ])
            expect(screen.getByTestId('sdk-wrapper')).toBeInTheDocument()
            expect(screen.queryByText(failure)).not.toBeInTheDocument()
            expect(handleInitiateKyc).not.toHaveBeenCalled()
            expect(handleRestartIdentity).not.toHaveBeenCalled()
            expect(handleSelfHealResubmit).not.toHaveBeenCalled()
        }
    )

    it('retains confirmation for unrelated identity gates', () => {
        const view = mountRemediation()
        act(() => view.current().resolveGate({ kind: 'needs-identity' } as GateState, 'ACH_US'))
        expect(mockModalVisible).toBe(true)
        expect(handleFixableGate).not.toHaveBeenCalled()
        expect(handleInitiateKyc).not.toHaveBeenCalled()
    })
})
