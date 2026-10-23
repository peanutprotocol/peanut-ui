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
// Callout and ProviderRow read the optional variant; both hooks see the same provider value.
jest.mock('@/context/ModalsContext', () => {
    const modals = { setIsSupportModalOpen: (...args: unknown[]) => mockOpenSupport(...args) }
    return { useModalsContext: () => modals, useModalsContextOptional: () => modals }
})
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

// The server's funding decision and the managed funding state it gates.
let mockAccess: { fundingMode: 'legacy' | 'managed'; enrollmentAllowed: boolean } | undefined
let mockManagementStatus: string | undefined
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ user: { user: { userId: 'user-1' } } }) }))
jest.mock('@/hooks/useCardFundingAccess', () => ({ useCardFundingAccess: () => ({ access: mockAccess }) }))
jest.mock('@tanstack/react-query', () => ({
    useQuery: ({ enabled }: { enabled?: boolean }) => ({
        data: enabled && mockManagementStatus ? { management: { status: mockManagementStatus } } : undefined,
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
    mockAccess = { fundingMode: 'managed', enrollmentAllowed: true }
    mockManagementStatus = 'ready'
})

// On the existing card permission the card balance is what card payments use:
// moving it out would only start a refill. The note and the move belong to
// managed funding, and the move waits until managed funding is ready.
describe('YourCardScreen — which accounts are offered the move', () => {
    const action = () => screen.queryByRole('button', { name: 'Move card balance to wallet' })

    it.each([true, false])(
        'an account on the existing permission (open to managed funding: %s) sees no note and no move',
        (enrollmentAllowed) => {
            mockAccess = { fundingMode: 'legacy', enrollmentAllowed }
            render(<YourCardScreen overview={overview(10_000)} card={CARD} />)
            expect(screen.queryByTestId('card-collateral')).not.toBeInTheDocument()
            expect(action()).not.toBeInTheDocument()
        }
    )

    it('an unread decision offers nothing', () => {
        mockAccess = undefined
        render(<YourCardScreen overview={overview(10_000)} card={CARD} />)
        expect(screen.queryByTestId('card-collateral')).not.toBeInTheDocument()
        expect(action()).not.toBeInTheDocument()
    })

    it.each(['required', 'migration_required', 'pending', 'temporarily_unavailable', undefined])(
        'a managed account whose funding is %s sees the note but no move yet',
        (status) => {
            mockManagementStatus = status
            render(<YourCardScreen overview={overview(10_000)} card={CARD} />)
            expect(screen.getByTestId('card-collateral')).toBeInTheDocument()
            expect(action()).not.toBeInTheDocument()
        }
    )

    it('a managed account keeps the move after new enrollment closed', () => {
        mockAccess = { fundingMode: 'managed', enrollmentAllowed: false }
        render(<YourCardScreen overview={overview(10_000)} card={CARD} />)
        expect(action()).toBeInTheDocument()
    })
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

    it('a card balance left from before is named plainly, with no claim about card payments', () => {
        render(<YourCardScreen overview={overview(10_000)} card={CARD} />)
        expect(screen.getByTestId('card-collateral')).toBeInTheDocument()
        expect(
            screen.getByText('You have $100.00 in your card balance. You can move it to your Peanut wallet.')
        ).toBeInTheDocument()
        expect(screen.queryByText(/collateral|cannot use|available for card payments/i)).not.toBeInTheDocument()
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
        expect(screen.queryByText(/in your card balance/)).not.toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'Contact support' }))
        expect(mockOpenSupport).toHaveBeenCalledWith(true)
    })
})
