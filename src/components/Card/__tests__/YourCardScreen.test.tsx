/**
 * YourCardScreen — the notes that matter.
 *
 * The provider pulls card payments from the smart WALLET, so collateral left
 * from before cannot pay a new card payment; that is said only when there is
 * some. The ordinary wallet balance is not repeated on this screen. A card debt
 * must not promise an automatic repayment that no longer exists.
 */
import React from 'react'
import { act, fireEvent, screen } from '@testing-library/react'
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
const mockReturnCollateral = jest.fn()
let mockIsReturning = false
let mockReturnError: { kind: string } | null = null
jest.mock('@/hooks/wallet/useCardCollateralReturn', () => ({
    useCardCollateralReturn: () => ({
        returnCollateral: mockReturnCollateral,
        isReturning: mockIsReturning,
        lastError: mockReturnError,
    }),
}))

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

const overview = (spendingPower: number | null, balanceUnavailable = false): RainCardOverview => ({
    status: { hasApplication: true },
    balance:
        spendingPower === null
            ? null
            : { creditLimit: 0, spendingPower, pendingCharges: 0, postedCharges: 0, balanceDue: 0 },
    ...(balanceUnavailable ? { balanceUnavailable } : {}),
    cards: [CARD],
})

beforeEach(() => {
    jest.clearAllMocks()
    mockIsReturning = false
    mockReturnError = null
    mockReturnCollateral.mockResolvedValue({ kind: 'returned', via: 'root', preparationId: 'prep-1' })
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

describe('YourCardScreen — move card balance to wallet', () => {
    const action = () => screen.queryByRole('button', { name: 'Move card balance to wallet' })

    it('offers the move only with a fresh positive balance', () => {
        const { rerender } = render(<YourCardScreen overview={overview(10_000)} card={CARD} />)
        expect(action()).toBeInTheDocument()

        rerender(<YourCardScreen overview={overview(0)} card={CARD} />)
        expect(action()).not.toBeInTheDocument()
        rerender(<YourCardScreen overview={overview(-631)} card={CARD} />)
        expect(action()).not.toBeInTheDocument()
        rerender(<YourCardScreen overview={overview(null)} card={CARD} />)
        expect(action()).not.toBeInTheDocument()
        // a cached figure still explains the collateral but offers no move
        rerender(<YourCardScreen overview={overview(10_000, true)} card={CARD} />)
        expect(screen.getByTestId('card-collateral')).toBeInTheDocument()
        expect(action()).not.toBeInTheDocument()
    })

    it('runs the return only: no lock, cancel or permission dialog follows', async () => {
        render(<YourCardScreen overview={overview(10_000)} card={CARD} />)
        await act(async () => {
            fireEvent.click(action()!)
        })
        expect(mockReturnCollateral).toHaveBeenCalledTimes(1)
        expect(mockReturnCollateral).toHaveBeenCalledWith()
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('shows progress and ignores taps while it runs', () => {
        mockIsReturning = true
        render(<YourCardScreen overview={overview(10_000)} card={CARD} />)
        fireEvent.click(screen.getByRole('button', { name: 'Moving…' }))
        expect(mockReturnCollateral).not.toHaveBeenCalled()
    })

    it('the note and the action leave only when a refreshed read shows no balance', () => {
        const { rerender } = render(<YourCardScreen overview={overview(10_000)} card={CARD} />)
        // a finished return with the old figure still on screen changes nothing
        rerender(<YourCardScreen overview={overview(10_000)} card={CARD} />)
        expect(action()).toBeInTheDocument()
        rerender(<YourCardScreen overview={overview(0)} card={CARD} />)
        expect(screen.queryByTestId('card-collateral')).not.toBeInTheDocument()
        expect(action()).not.toBeInTheDocument()
    })

    it.each([
        ['pending', /not confirmed yet/],
        ['cooldown', /cannot move right now/],
        ['balance-unavailable', /couldn't read your card balance/],
        ['busy', /Another card action is running/],
        ['failed', /Couldn't finish moving your card balance/],
        ['account-changed', /Couldn't finish moving your card balance/],
    ])('a %s return says so plainly', (kind, text) => {
        mockReturnError = { kind }
        render(<YourCardScreen overview={overview(10_000)} card={CARD} />)
        expect(screen.getByTestId('card-collateral-error')).toHaveTextContent(text)
        // a failure never claims that no money moved
        expect(screen.getByTestId('card-collateral-error')).not.toHaveTextContent(/nothing moved/i)
    })

    it('a dismissed passkey is not an error', () => {
        mockReturnError = { kind: 'cancelled' }
        render(<YourCardScreen overview={overview(10_000)} card={CARD} />)
        expect(screen.queryByTestId('card-collateral-error')).not.toBeInTheDocument()
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
