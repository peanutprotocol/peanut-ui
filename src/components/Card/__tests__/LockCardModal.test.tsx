/**
 * Regression tests for the lock/cancel collateral withdrawal (prod incident
 * 2026-07-24): both modals MUST force collateral-only routing when returning
 * spending power. Without `forceStrategy`, live routing picks smart-only
 * whenever the smart wallet covers the amount (spendPreflight), and the
 * modals then reject their own artifact ("Unexpected withdrawal strategy"),
 * so users with wallet balance ≥ card balance could neither lock nor cancel.
 *
 * Contracts locked down here, for BOTH modals:
 *  1. spendingPower > 0 → signSpend is called WITH forceStrategy:
 *     'collateral-only' (the assertion that catches the regression) and the
 *     signed withdrawal is delivered to the backend call,
 *  2. an unloaded overview fails closed BEFORE signing — undefined reads as
 *     zero spending power, which would silently skip the withdrawal and get
 *     the action rejected server-side,
 *  3. a loaded overview with zero spending power proceeds without signing
 *     (no passkey prompt when there is nothing to return).
 */
import React, { type ReactNode } from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { IntlWrapper } from '@/test-utils/intl'
import LockCardModal from '@/components/Card/LockCardModal'
import CancelCardModal from '@/components/Card/CancelCardModal'
import { useRainCardOverview } from '@/hooks/useRainCardOverview'
import { useWallet } from '@/hooks/wallet/useWallet'
import { useSignSpendBundle } from '@/hooks/wallet/useSignSpendBundle'
import { rainApi } from '@/services/rain'

const WALLET = '0xafbea1a6a6036d7d827e08072cd4315248b77352'
const mockToastSuccess = jest.fn()
const mockOnClose = jest.fn()

jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))
jest.mock('@/components/0_Bruddle/Toast', () => ({ useToast: () => ({ success: mockToastSuccess }) }))
jest.mock('@/hooks/useRainCardOverview', () => ({
    useRainCardOverview: jest.fn(),
    RAIN_CARD_OVERVIEW_QUERY_KEY: 'rain-card-overview',
}))
jest.mock('@/hooks/wallet/useWallet', () => ({ useWallet: jest.fn() }))
jest.mock('@/hooks/wallet/useSignSpendBundle', () => ({ useSignSpendBundle: jest.fn() }))
jest.mock('@/services/rain', () => ({
    rainApi: {
        lockCard: jest.fn(),
        activateCard: jest.fn(),
        cancelCard: jest.fn(),
        submitCancellationFeedback: jest.fn(),
        getOverview: jest.fn(),
    },
}))
const mockRevoke = jest.fn()
let mockFunding: { allowance: string } | undefined
jest.mock('@/hooks/wallet/useRainFunding', () => ({
    useRainFunding: () => ({ funding: mockFunding, revoke: mockRevoke }),
}))
// Modal chrome and the slide gesture are not under test — render passthroughs.
jest.mock('@/components/Global/Modal', () => ({
    __esModule: true,
    default: ({ visible, children }: { visible: boolean; children: React.ReactNode }) =>
        visible ? <div>{children}</div> : null,
}))
jest.mock('@/components/0_Bruddle/SlideToConfirm', () => ({
    __esModule: true,
    default: ({ label, onConfirm, disabled }: { label: string; onConfirm: () => void; disabled?: boolean }) => (
        <button onClick={onConfirm} disabled={disabled}>
            {label}
        </button>
    ),
}))

const mockOverview = useRainCardOverview as jest.Mock
const mockUseWallet = useWallet as jest.Mock
const mockUseSignSpendBundle = useSignSpendBundle as jest.Mock
const mockLockCard = rainApi.lockCard as jest.Mock
const mockActivateCard = rainApi.activateCard as jest.Mock
const mockCancelCard = rainApi.cancelCard as jest.Mock
const mockGetOverview = rainApi.getOverview as jest.Mock
const mockSignSpend = jest.fn()
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
const mockInvalidateQueries = jest.spyOn(queryClient, 'invalidateQueries')

const MAX_ALLOWANCE = (2n ** 256n - 1n).toString()
const CANCELED_CARD = { id: 'card-1', status: 'CANCELED' }
const RAIN_WITHDRAWAL = { preparationId: 'prep-1', amount: '10060000' }
// $10.06 spending power — the reporting user's exact state.
const OVERVIEW = { balance: { spendingPower: 1006 } }
const FORCED_SIGN_ARGS = {
    requiredUsdcAmount: 10_060_000n, // 1006 cents → 6dp USDC units
    recipient: WALLET,
    rainSpendingPower: 10_060_000n,
    kind: 'CRYPTO_WITHDRAW',
    forceStrategy: 'collateral-only',
}

const Wrapper = ({ children }: { children: ReactNode }) => (
    <IntlWrapper>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </IntlWrapper>
)

const setup = (overview?: { balance: { spendingPower: number } }) => {
    mockOverview.mockReturnValue({ overview })
    mockUseWallet.mockReturnValue({ address: WALLET })
    mockUseSignSpendBundle.mockReturnValue({ signSpend: mockSignSpend })
}

const renderLock = () =>
    render(<LockCardModal cardId="card-1" mode="lock" isOpen onClose={mockOnClose} />, { wrapper: Wrapper })
const renderUnlock = () =>
    render(<LockCardModal cardId="card-1" mode="unlock" isOpen onClose={mockOnClose} />, { wrapper: Wrapper })
const renderCancel = () => render(<CancelCardModal cardId="card-1" isOpen onClose={jest.fn()} />, { wrapper: Wrapper })

beforeEach(() => {
    jest.clearAllMocks()
    mockSignSpend.mockResolvedValue({ strategy: 'collateral-only', rainWithdrawal: RAIN_WITHDRAWAL })
    mockLockCard.mockResolvedValue({})
    mockActivateCard.mockResolvedValue({})
    mockCancelCard.mockResolvedValue({})
    // Default: a sibling card is still live, so cancel never offers the revoke.
    mockFunding = { allowance: MAX_ALLOWANCE }
    mockGetOverview.mockResolvedValue({ cards: [CANCELED_CARD, { id: 'card-2', status: 'ACTIVE' }] })
    mockRevoke.mockResolvedValue({ ok: true })
})

describe('LockCardModal — lock with spending power', () => {
    it('forces collateral-only routing and delivers the withdrawal to the lock call', async () => {
        setup(OVERVIEW)
        renderLock()
        fireEvent.click(screen.getByText('Slide to Lock'))
        await waitFor(() => expect(mockOnClose).toHaveBeenCalledTimes(1))
        expect(mockToastSuccess).toHaveBeenCalledWith('Card locked')
        expect(mockSignSpend).toHaveBeenCalledWith(FORCED_SIGN_ARGS)
        expect(mockLockCard).toHaveBeenCalledWith('card-1', RAIN_WITHDRAWAL)
        // a lock is reversible — it never touches Rain's wallet permission
        expect(mockRevoke).not.toHaveBeenCalled()
        expect(mockGetOverview).not.toHaveBeenCalled()
    })

    it('fails closed before signing when the overview has not loaded', async () => {
        setup(undefined)
        renderLock()
        fireEvent.click(screen.getByText('Slide to Lock'))
        expect(await screen.findByText(/still loading/)).toBeInTheDocument()
        expect(mockSignSpend).not.toHaveBeenCalled()
        expect(mockLockCard).not.toHaveBeenCalled()
    })

    it('locks without signing when there is no spending power to return', async () => {
        setup({ balance: { spendingPower: 0 } })
        renderLock()
        fireEvent.click(screen.getByText('Slide to Lock'))
        await waitFor(() => expect(mockOnClose).toHaveBeenCalledTimes(1))
        expect(mockToastSuccess).toHaveBeenCalledWith('Card locked')
        expect(mockSignSpend).not.toHaveBeenCalled()
        expect(mockLockCard).toHaveBeenCalledWith('card-1', undefined)
    })
})

describe('LockCardModal — unlock', () => {
    it('activates the card, refreshes the overview, and closes with a success toast', async () => {
        setup(OVERVIEW)
        renderUnlock()

        fireEvent.click(screen.getByRole('button', { name: 'Unlock' }))

        await waitFor(() => expect(mockOnClose).toHaveBeenCalledTimes(1))
        expect(mockActivateCard).toHaveBeenCalledWith('card-1')
        expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['rain-card-overview'] })
        expect(mockToastSuccess).toHaveBeenCalledWith('Card unlocked')
    })
})

describe('CancelCardModal', () => {
    it('forces collateral-only routing and delivers the withdrawal to the cancel call', async () => {
        setup(OVERVIEW)
        renderCancel()
        fireEvent.click(screen.getByRole('button', { name: 'Slide to Cancel' }))
        expect(await screen.findByText('Card canceled')).toBeInTheDocument()
        expect(mockSignSpend).toHaveBeenCalledWith(FORCED_SIGN_ARGS)
        expect(mockCancelCard).toHaveBeenCalledWith('card-1', { verifiedWithdrawal: RAIN_WITHDRAWAL })
    })

    it('fails closed before signing when the overview has not loaded', async () => {
        setup(undefined)
        renderCancel()
        fireEvent.click(screen.getByRole('button', { name: 'Slide to Cancel' }))
        expect(await screen.findByText(/still loading/)).toBeInTheDocument()
        expect(mockSignSpend).not.toHaveBeenCalled()
        expect(mockCancelCard).not.toHaveBeenCalled()
    })

    it('cancels without signing when there is no spending power to return', async () => {
        setup({ balance: { spendingPower: 0 } })
        renderCancel()
        fireEvent.click(screen.getByRole('button', { name: 'Slide to Cancel' }))
        expect(await screen.findByText('Card canceled')).toBeInTheDocument()
        expect(mockSignSpend).not.toHaveBeenCalled()
        expect(mockCancelCard).toHaveBeenCalledWith('card-1', { verifiedWithdrawal: undefined })
    })
})

/**
 * Rain's operator allowance is per WALLET. Removing it stops every card the
 * user holds, so the cancel flow may only offer it for the last card — and the
 * cancel itself must never depend on it.
 */
describe('CancelCardModal — removing Rain’s permission', () => {
    const cancel = () => {
        setup({ balance: { spendingPower: 0 } })
        renderCancel()
        fireEvent.click(screen.getByRole('button', { name: 'Slide to Cancel' }))
    }

    it('never offers the revoke while another non-cancelled card remains', async () => {
        cancel()
        expect(await screen.findByText('Card canceled')).toBeInTheDocument()
        expect(screen.queryByText("Remove Rain's permission")).not.toBeInTheDocument()
        expect(mockRevoke).not.toHaveBeenCalled()
    })

    it('never offers the revoke when the fresh card list cannot be read', async () => {
        mockGetOverview.mockRejectedValue(new Error('network'))
        cancel()
        expect(await screen.findByText('Card canceled')).toBeInTheDocument()
        expect(screen.queryByText("Remove Rain's permission")).not.toBeInTheDocument()
    })

    it('skips the revoke when there is no allowance to remove', async () => {
        mockFunding = { allowance: '0' }
        mockGetOverview.mockResolvedValue({ cards: [CANCELED_CARD] })
        cancel()
        expect(await screen.findByText('Card canceled')).toBeInTheDocument()
        expect(mockGetOverview).not.toHaveBeenCalled()
    })

    it('cancels FIRST, then offers the revoke for the last card and moves on once it lands', async () => {
        mockGetOverview.mockResolvedValue({ cards: [CANCELED_CARD, { id: 'card-0', status: 'CANCELED' }] })
        cancel()
        expect(await screen.findByText("Remove Rain's permission")).toBeInTheDocument()
        // the card is already cancelled before any revoke is attempted
        expect(mockCancelCard).toHaveBeenCalledTimes(1)
        expect(mockRevoke).not.toHaveBeenCalled()

        fireEvent.click(screen.getByRole('button', { name: 'Remove permission' }))
        expect(await screen.findByText('Card canceled')).toBeInTheDocument()
        expect(mockRevoke).toHaveBeenCalledTimes(1)
    })

    it('does not revoke if a replacement card appears after the offer', async () => {
        mockGetOverview.mockResolvedValueOnce({ cards: [CANCELED_CARD] })
        cancel()
        fireEvent.click(await screen.findByRole('button', { name: 'Remove permission' }))
        expect(await screen.findByText('Card canceled')).toBeInTheDocument()
        expect(mockRevoke).not.toHaveBeenCalled()
    })

    it('does not revoke if the card list fails when the offer is accepted', async () => {
        mockGetOverview.mockResolvedValueOnce({ cards: [CANCELED_CARD] }).mockRejectedValueOnce(new Error('network'))
        cancel()
        fireEvent.click(await screen.findByRole('button', { name: 'Remove permission' }))
        expect(await screen.findByText('Card canceled')).toBeInTheDocument()
        expect(mockRevoke).not.toHaveBeenCalled()
    })

    it('a failed revoke leaves the card cancelled and shows a retry', async () => {
        mockGetOverview.mockResolvedValue({ cards: [CANCELED_CARD] })
        mockRevoke.mockResolvedValueOnce({ ok: false, error: { kind: 'user-cancelled' } })
        cancel()
        fireEvent.click(await screen.findByRole('button', { name: 'Remove permission' }))

        expect(await screen.findByText('We could not remove the permission. Try again.')).toBeInTheDocument()
        expect(mockCancelCard).toHaveBeenCalledTimes(1)
        // still on the revoke step: retry works, and "Not now" still leaves
        fireEvent.click(screen.getByRole('button', { name: 'Remove permission' }))
        expect(await screen.findByText('Card canceled')).toBeInTheDocument()
        expect(mockRevoke).toHaveBeenCalledTimes(2)
    })

    it('"Not now" skips the revoke without touching the wallet', async () => {
        mockGetOverview.mockResolvedValue({ cards: [CANCELED_CARD] })
        cancel()
        fireEvent.click(await screen.findByRole('button', { name: 'Not now' }))
        expect(await screen.findByText('Card canceled')).toBeInTheDocument()
        expect(mockRevoke).not.toHaveBeenCalled()
    })
})
