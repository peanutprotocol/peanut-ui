/**
 * YourCardScreen — the notes that matter.
 *
 * The provider pulls card payments from the smart WALLET, so collateral left
 * from before cannot pay a new card payment; that is said only when there is
 * some. The ordinary wallet balance is not repeated on this screen. A card debt
 * must not promise an automatic repayment that no longer exists.
 */
import React from 'react'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithIntl as render } from '@/test-utils/intl'
import type { RainCardOverview, RainCardSummary } from '@/services/rain'

const mockOpenSupport = jest.fn()

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))
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
})

describe('YourCardScreen — collateral note', () => {
    it('shows no "available for card payments" summary: the wallet balance already lives on Home', () => {
        render(<YourCardScreen overview={overview(0)} card={CARD} />)
        expect(screen.queryByText(/available for card payments/i)).not.toBeInTheDocument()
        expect(screen.queryByTestId('card-collateral')).not.toBeInTheDocument()
        expect(screen.queryByText(/dollars in your Peanut wallet/)).not.toBeInTheDocument()
    })

    it('with no card overview balance there is no summary and no note', () => {
        render(<YourCardScreen overview={overview(null)} card={CARD} />)
        expect(screen.queryByText(/available for card payments/i)).not.toBeInTheDocument()
        expect(screen.queryByTestId('card-collateral')).not.toBeInTheDocument()
    })

    it('collateral left from before is still explained: a new card payment cannot use it', () => {
        render(<YourCardScreen overview={overview(10_000)} card={CARD} />)
        expect(screen.getByTestId('card-collateral')).toBeInTheDocument()
        expect(screen.getByText(/Another \$100\.00 is held as card collateral/)).toBeInTheDocument()
        expect(screen.getByText(/New card payments cannot use it/)).toBeInTheDocument()
        expect(screen.queryByText(/available for card payments/i)).not.toBeInTheDocument()
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
