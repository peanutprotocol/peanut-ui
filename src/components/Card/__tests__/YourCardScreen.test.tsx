/**
 * YourCardScreen — what the card can actually spend.
 *
 * Rain pulls every card payment from the smart WALLET. The home balance also
 * counts card collateral, which a new card payment cannot use, so the card
 * screen must state the wallet-only figure and never the combined one. A card
 * debt must not promise an automatic repayment that no longer exists.
 */
import React from 'react'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithIntl as render } from '@/test-utils/intl'
import type { RainCardOverview, RainCardSummary } from '@/services/rain'

const mockOpenSupport = jest.fn()
let mockWallet: { balance: bigint | undefined; formattedBalance: string }

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))
jest.mock('@/hooks/wallet/useWallet', () => ({ useWallet: () => mockWallet }))
jest.mock('@/context/ModalsContext', () => ({
    useModalsContext: () => ({ setIsSupportModalOpen: mockOpenSupport }),
}))
jest.mock('@/hooks/useCardReveal', () => ({
    useCardReveal: () => ({ revealed: null, isLoading: false, error: null, toggle: jest.fn() }),
}))
jest.mock('@/hooks/usePushProvisioning', () => ({
    usePushProvisioning: () => ({ nativeAvailable: false, isAdding: false, addToWallet: jest.fn() }),
}))
jest.mock('@/hooks/useWalletPlatform', () => ({ useWalletPlatform: () => null }))
jest.mock('@/hooks/useAppHaptic', () => ({ useAppHaptic: () => ({ triggerHaptic: jest.fn() }) }))
jest.mock('@/components/0_Bruddle/Toast', () => ({ useToast: () => ({ success: jest.fn(), error: jest.fn() }) }))
// Chrome and sibling surfaces are covered by their own suites.
jest.mock('@/components/Global/NavHeader', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Card/CardFace', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Card/CancelCardModal', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Card/LockCardModal', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Card/EnableCardPaymentsBanner', () => ({ __esModule: true, default: () => null }))

import YourCardScreen from '../YourCardScreen'

const CARD = {
    id: 'card-1',
    rainCardId: 'rain-1',
    last4: '0420',
    expiryMonth: 6,
    expiryYear: 2069,
    status: 'ACTIVE',
    network: 'visa',
    issuedAt: '2026-01-01T00:00:00Z',
    hasWithdrawApproval: true,
} satisfies RainCardSummary

const overview = (spendingPower: number | null): RainCardOverview => ({
    status: { hasApplication: true },
    balance:
        spendingPower === null
            ? null
            : { creditLimit: 0, spendingPower, pendingCharges: 0, postedCharges: 0, balanceDue: 0 },
    cards: [CARD],
})

beforeEach(() => {
    jest.clearAllMocks()
    mockWallet = { balance: 25_000_000n, formattedBalance: '25.00' }
})

describe('YourCardScreen — funds for card payments', () => {
    it('shows the wallet-only amount, not wallet + collateral', () => {
        render(<YourCardScreen overview={overview(0)} card={CARD} />)
        expect(screen.getByText('$25.00 available for card payments')).toBeInTheDocument()
        expect(screen.getByText('Card payments use the USDC in your Peanut wallet.')).toBeInTheDocument()
    })

    it('wallet $0 with $100 collateral reads as $0 for the card, and says what the collateral is for', () => {
        mockWallet = { balance: 0n, formattedBalance: '0.00' }
        render(<YourCardScreen overview={overview(10_000)} card={CARD} />)
        expect(screen.getByText('$0.00 available for card payments')).toBeInTheDocument()
        expect(screen.queryByText(/\$100\.00 available/)).not.toBeInTheDocument()
        expect(screen.getByText(/Another \$100\.00 is held as card collateral/)).toBeInTheDocument()
        expect(screen.getByText(/New card payments cannot use it/)).toBeInTheDocument()
    })

    it('shows no figure while the wallet balance is unknown — never a guessed $0', () => {
        mockWallet = { balance: undefined, formattedBalance: '0.00' }
        render(<YourCardScreen overview={overview(10_000)} card={CARD} />)
        expect(screen.queryByTestId('card-funds')).not.toBeInTheDocument()
    })
})

describe('YourCardScreen — card debt', () => {
    it('states the debt and offers support, with no automatic-repayment promise', () => {
        render(<YourCardScreen overview={overview(-631)} card={CARD} />)
        expect(screen.getByText('$6.31 outstanding on your card')).toBeInTheDocument()
        expect(screen.queryByText(/next deposit|cover the difference automatically/i)).not.toBeInTheDocument()
        // a debt is not collateral
        expect(screen.queryByText(/held as card collateral/)).not.toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'Contact support' }))
        expect(mockOpenSupport).toHaveBeenCalledWith(true)
    })
})
