/**
 * ActivationCTAs — the provider-rejection override must respect that a user can
 * already transact.
 *
 * A Sumsub-approved user whose *bank* rail is rejected used to always get the
 * "Complete your setup → Upload document" (fixable) / "Verification issue"
 * (blocked) home card, even when they hold an active card or another enabled
 * rail. For a card-holder that's a nag on a capability they don't need — and,
 * for a terminally-rejected bank rail, one they can't fix. The gate below
 * suppresses the override whenever the user can already transact (any enabled
 * rail — the card's rail reads `enabled` — or BE-marked `isActivated`). A
 * genuinely-fixable bank RFI still surfaces in the /add-money bank flow.
 */
import React from 'react'
import { render as rtlRender, screen, fireEvent } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'

const render = (ui: React.ReactElement) => rtlRender(ui, { wrapper: IntlWrapper })

let mockRails: Array<{
    id: string
    provider?: string
    channel: string
    status: string
    reason?: { userMessage: string }
}> = []
let mockUser: { user?: { isActivated?: boolean; userId?: string } } | null = null
let mockHasCardAccess: boolean | undefined = false
const mockHeal = jest.fn()
const mockPush = jest.fn()
const mockSetIsQRScannerOpen = jest.fn()

jest.mock('@/hooks/useCapabilities', () => ({
    useCapabilities: () => ({
        rails: mockRails,
        channelOf: (rail: { channel: string }) => rail.channel,
        nextActionsForRail: () => [],
        nextActions: [],
    }),
}))
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ user: mockUser }),
}))
let mockRegionRestricted = false
jest.mock('@/hooks/useIdentityVerification', () => ({
    useIdentityVerification: () => ({
        isProcessing: false,
        needsAction: false,
        isRegionRestricted: mockRegionRestricted,
    }),
}))
let mockResidenceRestrictions = { banking: false, card: false }
jest.mock('@/hooks/useResidenceRestrictions', () => ({
    useResidenceRestrictions: () => mockResidenceRestrictions,
}))
// Happy-path funnel steps render the checklist; these suites test the
// interrupt cards, so the checklist itself is a marker (own suite covers it).
jest.mock('@/components/Home/GettingStartedChecklist', () => ({
    __esModule: true,
    default: () => <div>getting-started-checklist</div>,
}))
jest.mock('@/context/ModalsContext', () => ({
    useModalsContext: () => ({ setIsQRScannerOpen: mockSetIsQRScannerOpen, openSupportWithMessage: jest.fn() }),
}))
jest.mock('@/hooks/useCardInfo', () => ({
    useCardInfo: () => ({ hasCardAccess: mockHasCardAccess }),
}))
jest.mock('@/components/Global/ActionModal', () => ({
    __esModule: true,
    default: (props: { visible: boolean; title?: string; ctas?: { text: string; onClick: () => void }[] }) =>
        props.visible ? (
            <div data-testid="spend-chooser">
                <p>{props.title}</p>
                {props.ctas?.map((c) => (
                    <button key={c.text} onClick={c.onClick}>
                        {c.text}
                    </button>
                ))}
            </div>
        ) : null,
}))
jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: mockPush }),
}))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))
jest.mock('@/components/Home/CardLaunchCTA/CardLaunchCTABanner', () => ({
    __esModule: true,

    default: () => null,
}))

jest.mock('@/hooks/useMultiPhaseKycFlow', () => ({
    useMultiPhaseKycFlow: () => ({ handleSelfHealResubmit: mockHeal }),
}))
jest.mock('@/components/Kyc/SumsubKycModals', () => ({
    SumsubKycModals: () => null,
}))

import ActivationCTAs from '../ActivationCTAs'

const bankRejected = {
    id: 'bridge.sepa_eu',
    provider: 'bridge',
    channel: 'bank',
    status: 'requires-info',
    reason: { userMessage: 'We need a valid proof of address document.' },
}
const enabledCardRail = { id: 'rain.card_rain', channel: 'card', status: 'enabled' }

beforeEach(() => {
    jest.clearAllMocks()
    mockRails = []
    mockUser = { user: { isActivated: false, userId: 'u1' } }
    mockHasCardAccess = false
    mockResidenceRestrictions = { banking: false, card: false }
    mockRegionRestricted = false
})

describe('ActivationCTAs — residence restrictions', () => {
    it('a fully restricted residence hides the verify CTA entirely', () => {
        mockResidenceRestrictions = { banking: true, card: true }
        const { container } = render(<ActivationCTAs activationStep="verify" />)
        expect(container.firstChild).toBeNull()
    })

    it('a partial restriction keeps the verify step, rendered as the checklist', () => {
        mockResidenceRestrictions = { banking: false, card: true }
        render(<ActivationCTAs activationStep="verify" />)
        expect(screen.getByText('getting-started-checklist')).toBeInTheDocument()
    })
})

describe('ActivationCTAs — region-restricted outranks every funnel step', () => {
    it('replaces the verify nag, which this user can never satisfy', () => {
        mockRegionRestricted = true
        render(<ActivationCTAs activationStep="verify" />)

        expect(screen.getByText("We can't verify IDs from your country")).toBeInTheDocument()
        expect(screen.queryByText('Verification issue')).not.toBeInTheDocument()
    })

    it('outranks the getting-started checklist — every listed step is a closed door', () => {
        mockRegionRestricted = true
        mockHasCardAccess = true
        render(<ActivationCTAs activationStep="card" />)

        expect(screen.getByText("We can't verify IDs from your country")).toBeInTheDocument()
        expect(screen.queryByText('getting-started-checklist')).not.toBeInTheDocument()
        fireEvent.click(screen.getByText('Send or request money'))
        expect(mockPush).toHaveBeenCalledWith('/send')
        expect(mockPush).not.toHaveBeenCalledWith('/shhhhh')
    })

    it('never opens support — support cannot lift a jurisdictional block', () => {
        mockRegionRestricted = true
        mockRails = [bankRejected]
        render(<ActivationCTAs activationStep="deposit" />)

        fireEvent.click(screen.getByText('Send or request money'))
        expect(mockPush).toHaveBeenCalledWith('/send')
    })
})

describe('ActivationCTAs — rejection override respects existing transacting ability', () => {
    it('a card-holder (enabled card rail) with a rejected bank rail does NOT see "Complete your setup"', () => {
        mockRails = [enabledCardRail, bankRejected]
        render(<ActivationCTAs activationStep="deposit" />)
        expect(screen.queryByText('Complete your setup')).not.toBeInTheDocument()
        // Falls through to the checklist instead of the rejection card.
        expect(screen.getByText('getting-started-checklist')).toBeInTheDocument()
    })

    it('a BE-activated user with a rejected bank rail does NOT see the nag', () => {
        mockRails = [bankRejected]
        mockUser = { user: { isActivated: true, userId: 'u1' } }
        render(<ActivationCTAs activationStep="deposit" />)
        expect(screen.queryByText('Complete your setup')).not.toBeInTheDocument()
    })

    it('a user with NO working rail still sees the fixable-rejection nag (unchanged behavior)', () => {
        mockRails = [bankRejected]
        render(<ActivationCTAs activationStep="deposit" />)
        expect(screen.getByText('Complete your setup')).toBeInTheDocument()
        expect(screen.getByText('We need a valid proof of address document.')).toBeInTheDocument()
    })

    it('a card-ELIGIBLE user (access, no card) with a rejected bank rail sees the checklist, not the nag', () => {
        // The 2026-08-20 deposit-first gate moved this cohort off the card
        // step; without this shield they would trade the card banner for a
        // "Contact support" dead end over a rail the old region-picker detour
        // auto-enrolled. Crypto deposit → card is their working path.
        mockRails = [bankRejected]
        mockHasCardAccess = true
        render(<ActivationCTAs activationStep="deposit" />)
        expect(screen.queryByText('Complete your setup')).not.toBeInTheDocument()
        expect(screen.getByText('getting-started-checklist')).toBeInTheDocument()
    })

    it('fixable rejection: Upload document heals inline (handleSelfHealResubmit), does not navigate away', () => {
        mockRails = [bankRejected]
        render(<ActivationCTAs activationStep="deposit" />)
        fireEvent.click(screen.getByText('Upload document'))
        expect(mockHeal).toHaveBeenCalledWith('BRIDGE')
        expect(mockPush).not.toHaveBeenCalled()
    })
})

describe('ActivationCTAs — happy path renders the checklist', () => {
    it.each(['verify', 'deposit', 'card', 'outbound'] as const)('%s step renders the checklist', (step) => {
        render(<ActivationCTAs activationStep={step} />)
        expect(screen.getByText('getting-started-checklist')).toBeInTheDocument()
    })

    it('completed without rejection renders nothing', () => {
        const { container } = render(<ActivationCTAs activationStep="completed" />)
        expect(container.firstChild).toBeNull()
    })
})
