/** @jest-environment jsdom */
import { fireEvent, screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import en from '@/i18n/app/messages/en.json'
import type { CapabilityRoute, NextAction } from '@/types/capabilities'

jest.mock('next/navigation', () => ({ usePathname: () => '/withdraw/pix' }))
jest.mock('@/components/Global/NavHeader', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Provider/ProviderFinePrint', () => ({ ProviderFinePrint: () => null }))
jest.mock('@/components/Kyc/SumsubKycModals', () => ({ SumsubKycModals: () => null }))
jest.mock('@/features/pix/components/PixUnavailableScreen', () => ({
    PixUnavailableScreen: () => <div>unavailable</div>,
}))
type SheetProps = { visible: boolean; country?: string; unlocks?: string; onComplete: () => void; onSkip: () => void }
const mockSheet = (name: string, props: SheetProps) =>
    props.visible ? (
        <div data-testid={name} data-country={props.country} data-unlocks={props.unlocks}>
            <button onClick={props.onSkip}>not now</button>
        </div>
    ) : null
jest.mock('@/components/Kyc/BridgeTosStep', () => ({
    BridgeTosStep: (props: SheetProps) => mockSheet('bridge-terms', props),
}))
jest.mock('@/components/Kyc/ProvideEmailStep', () => ({
    __esModule: true,
    default: (props: SheetProps) => mockSheet('email', props),
}))
const mockKycPage = jest.fn()
jest.mock('@/components/Kyc/InitiateKycModal', () => ({
    InitiateKycModal: (props: { onVerify: () => void; variant?: string; presentation?: string }) => {
        mockKycPage(props)
        return <button onClick={props.onVerify}>start the step</button>
    },
}))
const mockFlow = { isLoading: false, error: null, errorCooldown: null }
jest.mock('@/hooks/useMultiPhaseKycFlow', () => ({ useMultiPhaseKycFlow: () => mockFlow }))
const mockVerify = jest.fn()
jest.mock('@/hooks/useGateActions', () => ({
    useGateActions: () => ({ verify: mockVerify, contactSupport: jest.fn() }),
}))
let mockNextActions: NextAction[] = []
jest.mock('@/hooks/useCapabilities', () => ({
    useCapabilities: () => ({ rails: [], nextActions: mockNextActions }),
}))

import { PixRailStep } from '../components/PixRailStep'

const route = (action: string, overrides: Partial<CapabilityRoute> = {}): CapabilityRoute => ({
    operation: 'withdraw',
    method: 'PIX_BR',
    provider: 'bridge',
    state: 'action_required',
    action,
    reason: { code: 'first_use_required', userMessage: 'Set up this payment method to continue.' },
    candidates: [],
    ...overrides,
})
const renderStep = (r: CapabilityRoute) =>
    renderWithIntl(<PixRailStep title="Withdraw" onBack={jest.fn()} route={r} providerId="bridge" />)

describe('PixRailStep', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockNextActions = []
    })

    it("opens the bank rails' terms for Brazil on arrival, and the page opens them again after Not now", () => {
        mockNextActions = [{ key: 'accept-tos', kind: 'accept-tos', purpose: 'accept-bridge-tos' }]
        renderStep(route('accept-tos'))
        expect(screen.getByTestId('bridge-terms')).toHaveAttribute('data-country', 'BR')
        // the terms say they turn on Pix, not bank transfers
        expect(screen.getByTestId('bridge-terms')).toHaveAttribute('data-unlocks', en.home.pendingTasks.corridors.BRL)
        fireEvent.click(screen.getByRole('button', { name: 'not now' }))
        expect(screen.queryByTestId('bridge-terms')).toBeNull()
        fireEvent.click(screen.getByRole('button', { name: en.common.continue }))
        expect(screen.getByTestId('bridge-terms')).toBeInTheDocument()
        expect(mockKycPage).not.toHaveBeenCalled()
    })

    it('asks for the missing email in the email sheet', () => {
        mockNextActions = [{ key: 'provide-email', kind: 'provide-email', purpose: 'provide-email' }]
        renderStep(route('provide-email'))
        expect(screen.getByTestId('email')).toBeInTheDocument()
        expect(screen.queryByTestId('bridge-terms')).toBeNull()
    })

    it("runs a document step through the bank rails' verification page, back to this page", () => {
        const step: NextAction = {
            key: 'sumsub:tax_identification_number',
            kind: 'sumsub',
            purpose: 'unlock-bridge',
            levelKey: 'tax_identification_number',
        }
        mockNextActions = [step]
        renderStep(
            route(step.key, {
                reason: { code: 'tax_identification_number', userMessage: 'We need your tax ID.' },
            })
        )
        expect(mockKycPage).toHaveBeenCalledWith(
            expect.objectContaining({
                presentation: 'page',
                variant: 'provider_rejection',
                reasonCode: 'tax_identification_number',
                nextAction: step,
            })
        )
        fireEvent.click(screen.getByRole('button', { name: 'start the step' }))
        expect(mockVerify).toHaveBeenCalledWith(
            expect.objectContaining({ kind: 'fixable-rejection', actionKey: step.key, nextAction: step }),
            { provider: 'BRIDGE', returnTo: '/withdraw/pix' }
        )
    })

    it('runs the hosted check as the bank rails do', () => {
        const hosted: NextAction = {
            key: 'bridge-hosted',
            kind: 'bridge-hosted',
            purpose: 'bridge-additional-verification',
            currency: 'BRL',
        }
        mockNextActions = [hosted]
        renderStep(route('bridge-hosted'))
        fireEvent.click(screen.getByRole('button', { name: 'start the step' }))
        expect(mockVerify).toHaveBeenCalledWith(expect.objectContaining({ nextAction: hosted }), {
            provider: 'BRIDGE',
            returnTo: '/withdraw/pix',
        })
    })

    it('offers a new identity document where the rail asks for one', () => {
        mockNextActions = [{ key: 'restart-identity', kind: 'restart-identity', purpose: 'restart-identity' }]
        renderStep(route('restart-identity'))
        expect(mockKycPage).toHaveBeenCalledWith(expect.objectContaining({ variant: 'restart_identity' }))
    })

    // ruled 13 Nov (orchestrator): Manteca's Pix route gets the same screens; before, "contact support"
    it("runs a Manteca route's document step as Manteca's own fix", () => {
        const step: NextAction = {
            key: 'sumsub:pep_documentation',
            kind: 'sumsub',
            purpose: 'unlock-manteca',
            levelKey: 'pep_documentation',
        }
        mockNextActions = [step]
        renderStep(route(step.key, { provider: 'manteca', operation: 'deposit' }))
        expect(mockKycPage).toHaveBeenCalledWith(
            expect.objectContaining({ presentation: 'page', variant: 'provider_rejection', nextAction: step })
        )
        fireEvent.click(screen.getByRole('button', { name: 'start the step' }))
        expect(mockVerify).toHaveBeenCalledWith(expect.objectContaining({ actionKey: step.key }), {
            provider: 'MANTECA',
            returnTo: '/withdraw/pix',
        })
    })

    it('sends a route whose provider runs no identity fix to support', () => {
        mockNextActions = [{ key: 'accept-tos', kind: 'accept-tos', purpose: 'accept-bridge-tos' }]
        renderStep(route('accept-tos', { provider: 'rain' }))
        expect(screen.getByText('unavailable')).toBeInTheDocument()
    })
})
