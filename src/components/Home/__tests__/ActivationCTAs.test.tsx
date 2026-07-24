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
import { render, screen, fireEvent } from '@testing-library/react'

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
jest.mock('@/hooks/useIdentityVerification', () => ({
    useIdentityVerification: () => ({ isProcessing: false, needsAction: false }),
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
import posthog from 'posthog-js'

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
})

describe('ActivationCTAs — rejection override respects existing transacting ability', () => {
    it('a card-holder (enabled card rail) with a rejected bank rail does NOT see "Complete your setup"', () => {
        mockRails = [enabledCardRail, bankRejected]
        render(<ActivationCTAs activationStep="deposit" />)
        expect(screen.queryByText('Complete your setup')).not.toBeInTheDocument()
        // Falls through to the normal funnel step instead of the rejection card.
        expect(screen.getByText('Deposit')).toBeInTheDocument()
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

    it('fixable rejection: Upload document heals inline (handleSelfHealResubmit), does not navigate away', () => {
        mockRails = [bankRejected]
        render(<ActivationCTAs activationStep="deposit" />)
        fireEvent.click(screen.getByText('Upload document'))
        expect(mockHeal).toHaveBeenCalledWith('BRIDGE')
        expect(mockPush).not.toHaveBeenCalled()
    })
})

/**
 * The outbound step was QR-only ("Make your first payment" → scanner) while
 * card spend counts as activation too. Card-access users now get card-inclusive
 * "Spend with Peanut" copy and a card/QR chooser; users without card access
 * keep the exact old behavior so a gated card is never teased.
 */
describe('ActivationCTAs — outbound step spend chooser (card + QR)', () => {
    it('without card access: QR-only copy unchanged, CTA goes straight to the scanner, no chooser', () => {
        render(<ActivationCTAs activationStep="outbound" />)
        expect(screen.getByText('Make your first payment')).toBeInTheDocument()
        expect(screen.getByText('Start paying to Pix and MercadoPago QR codes')).toBeInTheDocument()
        fireEvent.click(screen.getByText('Start Spending'))
        expect(mockSetIsQRScannerOpen).toHaveBeenCalledWith(true)
        expect(screen.queryByTestId('spend-chooser')).not.toBeInTheDocument()
    })

    it('while card access is still loading (undefined): treated as no access — scanner, no chooser', () => {
        mockHasCardAccess = undefined
        render(<ActivationCTAs activationStep="outbound" />)
        expect(screen.getByText('Make your first payment')).toBeInTheDocument()
        fireEvent.click(screen.getByText('Start Spending'))
        expect(mockSetIsQRScannerOpen).toHaveBeenCalledWith(true)
        expect(screen.queryByTestId('spend-chooser')).not.toBeInTheDocument()
    })

    it('with card access: card-inclusive copy, CTA opens the chooser (not the scanner) and tracks it', () => {
        mockHasCardAccess = true
        render(<ActivationCTAs activationStep="outbound" />)
        expect(screen.getByText('Spend with Peanut')).toBeInTheDocument()
        fireEvent.click(screen.getByText('Start Spending'))
        expect(screen.getByTestId('spend-chooser')).toBeInTheDocument()
        expect(mockSetIsQRScannerOpen).not.toHaveBeenCalled()
        expect(posthog.capture).toHaveBeenCalledWith('activation_spend_chooser_shown')
    })

    it('chooser → card navigates to /card and tracks the choice', () => {
        mockHasCardAccess = true
        render(<ActivationCTAs activationStep="outbound" />)
        fireEvent.click(screen.getByText('Start Spending'))
        fireEvent.click(screen.getByText('Pay with your card'))
        expect(mockPush).toHaveBeenCalledWith('/card')
        expect(posthog.capture).toHaveBeenCalledWith('activation_spend_chooser_selected', { choice: 'card' })
    })

    it('chooser → QR opens the existing scanner and tracks the choice', () => {
        mockHasCardAccess = true
        render(<ActivationCTAs activationStep="outbound" />)
        fireEvent.click(screen.getByText('Start Spending'))
        fireEvent.click(screen.getByText('Scan a QR code'))
        expect(mockSetIsQRScannerOpen).toHaveBeenCalledWith(true)
        expect(mockPush).not.toHaveBeenCalled()
        expect(posthog.capture).toHaveBeenCalledWith('activation_spend_chooser_selected', { choice: 'qr' })
    })

    it('card access revoked while the chooser is open: chooser closes (no stale card option)', () => {
        mockHasCardAccess = true
        const { rerender } = render(<ActivationCTAs activationStep="outbound" />)
        fireEvent.click(screen.getByText('Start Spending'))
        expect(screen.getByTestId('spend-chooser')).toBeInTheDocument()
        mockHasCardAccess = false
        rerender(<ActivationCTAs activationStep="outbound" />)
        expect(screen.queryByTestId('spend-chooser')).not.toBeInTheDocument()
    })
})
