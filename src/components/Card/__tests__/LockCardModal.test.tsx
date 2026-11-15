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
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { IntlWrapper } from '@/test-utils/intl'
import LockCardModal from '@/components/Card/LockCardModal'
import CancelCardModal from '@/components/Card/CancelCardModal'
import { useRainCardOverview } from '@/hooks/useRainCardOverview'
import { useWallet } from '@/hooks/wallet/useWallet'
import { useSignSpendBundle } from '@/hooks/wallet/useSignSpendBundle'
import { ApiError } from '@/services/api-error'
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
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ user: { user: { userId: 'user-a' } } }) }))
jest.mock('@/hooks/wallet/useWallet', () => ({ useWallet: jest.fn() }))
jest.mock('@/hooks/wallet/useSignSpendBundle', () => ({ useSignSpendBundle: jest.fn() }))
jest.mock('@/services/rain', () => ({
    rainApi: {
        lockCard: jest.fn(),
        activateCard: jest.fn(),
        cancelCard: jest.fn(),
        getOverview: jest.fn(),
        getCardFunding: jest.fn(),
    },
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
const mockGetCardFunding = rainApi.getCardFunding as jest.Mock
const mockSignSpend = jest.fn()
const mockRefetchOverview = jest.fn()
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
const mockInvalidateQueries = jest.spyOn(queryClient, 'invalidateQueries')

const RAIN_WITHDRAWAL = { preparationId: 'prep-1', amount: '10060000', expiresAt: 4_102_444_800 }
// $10.06 spending power — the reporting user's exact state.
const OVERVIEW = { balance: { spendingPower: 1006 } }
const FORCED_SIGN_ARGS = {
    requiredUsdcAmount: 10_060_000n, // 1006 cents → 6dp USDC units
    recipient: WALLET,
    rainSpendingPower: 10_060_000n,
    kind: 'CRYPTO_WITHDRAW',
    forceStrategy: 'collateral-only',
}

// The backend's answers about the wallet payment stop (TASK-22887 card-stop contract).
const stopped = (state: 'pending' | 'unavailable' | 'not_applicable') => ({
    status: 'LOCKED',
    fundingStop: { state, reason: state === 'pending' ? 'card_locked' : null },
})
const funding = (state: 'pending' | 'confirmed' | 'unavailable' | null) => ({
    walletAddress: WALLET,
    management: { stop: state && { cause: 'card_locked', state } },
})

const Wrapper = ({ children }: { children: ReactNode }) => (
    <IntlWrapper>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </IntlWrapper>
)

const setup = (overview?: { balance: { spendingPower: number; creditLimit?: number } }) => {
    mockOverview.mockReturnValue({ overview, refetch: mockRefetchOverview })
    mockRefetchOverview.mockResolvedValue({ data: overview })
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
    queryClient.clear()
    mockSignSpend.mockResolvedValue({ strategy: 'collateral-only', rainWithdrawal: RAIN_WITHDRAWAL })
    mockLockCard.mockResolvedValue({})
    mockActivateCard.mockResolvedValue({})
    mockCancelCard.mockResolvedValue({})
    mockGetCardFunding.mockResolvedValue(funding(null))
})

describe('LockCardModal — lock with spending power', () => {
    it('forces collateral-only routing and delivers the withdrawal to the lock call', async () => {
        setup(OVERVIEW)
        renderLock()
        fireEvent.click(screen.getByText('Slide to freeze'))
        await waitFor(() => expect(mockOnClose).toHaveBeenCalledTimes(1))
        expect(mockToastSuccess).toHaveBeenCalledWith('Card frozen')
        expect(mockSignSpend).toHaveBeenCalledWith(FORCED_SIGN_ARGS)
        expect(mockLockCard).toHaveBeenCalledWith('card-1', RAIN_WITHDRAWAL)
        // a lock is reversible — it reads no card list beyond the overview
        expect(mockGetOverview).not.toHaveBeenCalled()
    })

    it('fails closed before signing when the overview has not loaded', async () => {
        setup(undefined)
        renderLock()
        fireEvent.click(screen.getByText('Slide to freeze'))
        expect(await screen.findByText(/still loading/)).toBeInTheDocument()
        expect(mockSignSpend).not.toHaveBeenCalled()
        expect(mockLockCard).not.toHaveBeenCalled()
    })

    it('locks without signing when there is no spending power to return', async () => {
        setup({ balance: { spendingPower: 0 } })
        renderLock()
        fireEvent.click(screen.getByText('Slide to freeze'))
        await waitFor(() => expect(mockOnClose).toHaveBeenCalledTimes(1))
        expect(mockToastSuccess).toHaveBeenCalledWith('Card frozen')
        expect(mockSignSpend).not.toHaveBeenCalled()
        expect(mockLockCard).toHaveBeenCalledWith('card-1', undefined)
    })
})

/**
 * Wallet payments stop with the card (TASK-22887). The lock/cancel response says
 * the CARD is done; "payments stopped" is shown only when the live funding read
 * confirms it. Pending, unavailable and an unreadable status never claim it.
 */
describe('LockCardModal — wallet payment stop', () => {
    const lockNow = async () => {
        setup({ balance: { spendingPower: 0 } })
        renderLock()
        fireEvent.click(screen.getByText('Slide to freeze'))
    }
    const STOPPED = /Payments from your wallet to this card are stopped/
    const IN_PROGRESS = /still in progress/

    afterEach(() => jest.useRealTimers())

    it('stays open while the stop is pending, then confirms once the live read says zero', async () => {
        jest.useFakeTimers()
        mockLockCard.mockResolvedValue(stopped('pending'))
        mockGetCardFunding.mockResolvedValueOnce(funding('pending')).mockResolvedValue(funding('confirmed'))
        await lockNow()

        expect(await screen.findByText(IN_PROGRESS)).toBeInTheDocument()
        expect(screen.getByText('Card frozen')).toBeInTheDocument()
        expect(screen.queryByText(STOPPED)).not.toBeInTheDocument()
        expect(mockOnClose).not.toHaveBeenCalled()

        await act(async () => {
            await jest.advanceTimersByTimeAsync(3_100)
        })
        expect(await screen.findByText(STOPPED)).toBeInTheDocument()
        expect(screen.queryByText(IN_PROGRESS)).not.toBeInTheDocument()
    })

    it('a failed status read keeps the lock a success, says it could not check, and Check status recovers', async () => {
        mockLockCard.mockResolvedValue(stopped('pending'))
        mockGetCardFunding.mockRejectedValue(new Error('offline'))
        await lockNow()

        expect(await screen.findByText(/couldn't check yet/)).toBeInTheDocument()
        expect(screen.getByText('Card frozen')).toBeInTheDocument()
        expect(screen.queryByText(/Failed to lock/)).not.toBeInTheDocument()
        expect(screen.queryByText(STOPPED)).not.toBeInTheDocument()

        mockGetCardFunding.mockResolvedValue(funding('confirmed'))
        fireEvent.click(screen.getByRole('button', { name: 'Check status' }))
        expect(await screen.findByText(STOPPED)).toBeInTheDocument()
    })

    it('keeps polling after a failed first read, within the one-minute window', async () => {
        jest.useFakeTimers()
        mockLockCard.mockResolvedValue(stopped('pending'))
        mockGetCardFunding.mockRejectedValueOnce(new Error('offline')).mockResolvedValue(funding('confirmed'))
        await lockNow()
        expect(await screen.findByText(/couldn't check yet/)).toBeInTheDocument()

        await act(async () => {
            await jest.advanceTimersByTimeAsync(3_100)
        })
        expect(await screen.findByText(STOPPED)).toBeInTheDocument()
    })

    it('stops polling after the window and leaves Check status, never an endless "in progress"', async () => {
        jest.useFakeTimers()
        mockLockCard.mockResolvedValue(stopped('pending'))
        mockGetCardFunding.mockResolvedValue(funding('pending'))
        await lockNow()
        expect(await screen.findByText(IN_PROGRESS)).toBeInTheDocument()

        await act(async () => {
            await jest.advanceTimersByTimeAsync(65_000)
        })
        const reads = mockGetCardFunding.mock.calls.length
        await act(async () => {
            await jest.advanceTimersByTimeAsync(30_000)
        })
        expect(mockGetCardFunding).toHaveBeenCalledTimes(reads)
        expect(screen.getByRole('button', { name: 'Check status' })).toBeInTheDocument()
    })

    it.each([
        ['an action response', stopped('unavailable'), funding(null)],
        ['the live read', stopped('pending'), funding('unavailable')],
    ])('unavailable from %s: asks for support and never claims a stop', async (_from, response, live) => {
        mockLockCard.mockResolvedValue(response)
        mockGetCardFunding.mockResolvedValue(live)
        await lockNow()

        expect(
            await screen.findByText(/couldn't confirm that payments from your wallet have stopped/)
        ).toBeInTheDocument()
        expect(screen.queryByText(STOPPED)).not.toBeInTheDocument()
    })

    it('a wallet with nothing managed says nothing about a stop: toast and close, no status read', async () => {
        mockLockCard.mockResolvedValue(stopped('not_applicable'))
        await lockNow()

        await waitFor(() => expect(mockOnClose).toHaveBeenCalledTimes(1))
        expect(mockToastSuccess).toHaveBeenCalledWith('Card frozen')
        expect(mockGetCardFunding).not.toHaveBeenCalled()
    })

    it('a retry after a failed attempt reuses the signed proof: no second signature', async () => {
        setup(OVERVIEW)
        mockLockCard.mockRejectedValueOnce(new Error('gateway timeout')).mockResolvedValue(stopped('not_applicable'))
        renderLock()
        fireEvent.click(screen.getByText('Slide to freeze'))
        expect(await screen.findByText('gateway timeout')).toBeInTheDocument()

        fireEvent.click(screen.getByText('Slide to freeze'))
        await waitFor(() => expect(mockOnClose).toHaveBeenCalledTimes(1))
        expect(mockSignSpend).toHaveBeenCalledTimes(1)
        expect(mockLockCard).toHaveBeenCalledTimes(2)
        expect(mockLockCard).toHaveBeenLastCalledWith('card-1', RAIN_WITHDRAWAL)
    })

    it('closing and reopening after a failed attempt still reuses the signed proof', async () => {
        setup(OVERVIEW)
        mockLockCard.mockRejectedValueOnce(new Error('gateway timeout')).mockResolvedValue(stopped('not_applicable'))
        const { rerender } = renderLock()
        fireEvent.click(screen.getByText('Slide to freeze'))
        expect(await screen.findByText('gateway timeout')).toBeInTheDocument()

        rerender(<LockCardModal cardId="card-1" mode="lock" isOpen={false} onClose={mockOnClose} />)
        rerender(<LockCardModal cardId="card-1" mode="lock" isOpen onClose={mockOnClose} />)
        fireEvent.click(screen.getByText('Slide to freeze'))
        await waitFor(() => expect(mockOnClose).toHaveBeenCalledTimes(1))
        expect(mockSignSpend).toHaveBeenCalledTimes(1)
        expect(mockLockCard).toHaveBeenLastCalledWith('card-1', RAIN_WITHDRAWAL)
    })

    it('an expired proof (410) is not reused: the retry signs again', async () => {
        setup(OVERVIEW)
        mockLockCard
            .mockRejectedValueOnce(new ApiError('expired', { status: 410 }))
            .mockResolvedValue(stopped('not_applicable'))
        renderLock()
        fireEvent.click(screen.getByText('Slide to freeze'))
        expect(await screen.findByText('expired')).toBeInTheDocument()

        fireEvent.click(screen.getByText('Slide to freeze'))
        await waitFor(() => expect(mockOnClose).toHaveBeenCalledTimes(1))
        expect(mockSignSpend).toHaveBeenCalledTimes(2)
    })
})

describe('LockCardModal — unlock', () => {
    it('keeps the modal open and says payments stay stopped when the backend kept the stop', async () => {
        setup(OVERVIEW)
        mockActivateCard.mockResolvedValue({ status: 'ACTIVE', fundingStop: { state: 'kept', reason: 'paused' } })
        renderUnlock()
        fireEvent.click(screen.getByRole('button', { name: 'Unfreeze' }))

        expect(await screen.findByText(/payments from your wallet stay stopped for now/)).toBeInTheDocument()
        expect(screen.getByText('Card unfrozen')).toBeInTheDocument()
        expect(mockOnClose).not.toHaveBeenCalled()
        expect(mockGetCardFunding).not.toHaveBeenCalled()
    })

    it('a lift the backend could not finish (fundingStop null) is not "done": same notice, Unlock retries, nothing is withdrawn', async () => {
        setup(OVERVIEW)
        mockActivateCard
            .mockResolvedValueOnce({ status: 'ACTIVE', fundingStop: null })
            .mockResolvedValueOnce({ status: 'ACTIVE', fundingStop: { state: 'resumed', reason: null } })
        renderUnlock()
        fireEvent.click(screen.getByRole('button', { name: 'Unfreeze' }))

        expect(await screen.findByText(/couldn't confirm that payments from your wallet resumed/)).toBeInTheDocument()
        expect(mockOnClose).not.toHaveBeenCalled()
        expect(mockToastSuccess).not.toHaveBeenCalled()

        fireEvent.click(screen.getByRole('button', { name: 'Unfreeze' }))
        await waitFor(() => expect(mockOnClose).toHaveBeenCalledTimes(1))
        expect(mockActivateCard).toHaveBeenCalledTimes(2)
        expect(mockSignSpend).not.toHaveBeenCalled()
    })

    it.each(['card_action_in_progress', 'card_action_incomplete'])(
        'a 409 %s is shown as the backend says it, and no withdrawal is signed',
        async (code) => {
            setup(OVERVIEW)
            mockActivateCard.mockRejectedValue(new ApiError('backend says wait', { status: 409, code }))
            renderUnlock()
            fireEvent.click(screen.getByRole('button', { name: 'Unfreeze' }))

            expect(await screen.findByText('backend says wait')).toBeInTheDocument()
            expect(mockSignSpend).not.toHaveBeenCalled()
        }
    )

    it('a 409 card_action_in_progress on a lock keeps the signed proof: the retry signs nothing again', async () => {
        setup(OVERVIEW)
        mockLockCard
            .mockRejectedValueOnce(
                new ApiError('another action is running', { status: 409, code: 'card_action_in_progress' })
            )
            .mockResolvedValue(stopped('not_applicable'))
        renderLock()
        fireEvent.click(screen.getByText('Slide to freeze'))
        expect(await screen.findByText('another action is running')).toBeInTheDocument()

        fireEvent.click(screen.getByText('Slide to freeze'))
        await waitFor(() => expect(mockOnClose).toHaveBeenCalledTimes(1))
        expect(mockSignSpend).toHaveBeenCalledTimes(1)
    })

    it('a resumed stop closes with the plain success toast and claims nothing about payments', async () => {
        setup(OVERVIEW)
        mockActivateCard.mockResolvedValue({ status: 'ACTIVE', fundingStop: { state: 'resumed', reason: null } })
        renderUnlock()
        fireEvent.click(screen.getByRole('button', { name: 'Unfreeze' }))

        await waitFor(() => expect(mockOnClose).toHaveBeenCalledTimes(1))
        expect(mockToastSuccess).toHaveBeenCalledWith('Card unfrozen')
        expect(screen.queryByText(/wallet/)).not.toBeInTheDocument()
    })

    it('activates the card, refreshes the overview, and closes with a success toast', async () => {
        setup(OVERVIEW)
        renderUnlock()

        fireEvent.click(screen.getByRole('button', { name: 'Unfreeze' }))

        await waitFor(() => expect(mockOnClose).toHaveBeenCalledTimes(1))
        expect(mockActivateCard).toHaveBeenCalledWith('card-1')
        expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['rain-card-overview'] })
        expect(mockToastSuccess).toHaveBeenCalledWith('Card unfrozen')
    })
})

describe('CancelCardModal', () => {
    it('offers "Keep card" as the tertiary link, and it closes without canceling', () => {
        setup(OVERVIEW)
        const onClose = jest.fn()
        render(<CancelCardModal cardId="card-1" isOpen onClose={onClose} />, { wrapper: Wrapper })
        fireEvent.click(screen.getByRole('button', { name: 'Keep card' }))
        expect(onClose).toHaveBeenCalledTimes(1)
        expect(mockCancelCard).not.toHaveBeenCalled()
    })

    it('forces collateral-only routing and delivers the withdrawal to the cancel call', async () => {
        setup(OVERVIEW)
        renderCancel()
        fireEvent.click(screen.getByRole('button', { name: 'Slide to cancel' }))
        expect(await screen.findByText('Card canceled')).toBeInTheDocument()
        expect(mockSignSpend).toHaveBeenCalledWith(FORCED_SIGN_ARGS)
        expect(mockCancelCard).toHaveBeenCalledWith('card-1', { verifiedWithdrawal: RAIN_WITHDRAWAL })
    })

    it('fails closed before signing when the overview has not loaded', async () => {
        setup(undefined)
        renderCancel()
        fireEvent.click(screen.getByRole('button', { name: 'Slide to cancel' }))
        expect(await screen.findByText(/still loading/)).toBeInTheDocument()
        expect(mockSignSpend).not.toHaveBeenCalled()
        expect(mockCancelCard).not.toHaveBeenCalled()
    })

    it('cancels without signing when there is no spending power to return', async () => {
        setup({ balance: { spendingPower: 0 } })
        renderCancel()
        fireEvent.click(screen.getByRole('button', { name: 'Slide to cancel' }))
        expect(await screen.findByText('Card canceled')).toBeInTheDocument()
        expect(mockSignSpend).not.toHaveBeenCalled()
        expect(mockCancelCard).toHaveBeenCalledWith('card-1', { verifiedWithdrawal: undefined })
    })

    it('says the stop is in progress next to "Card canceled", and confirms only from the live read', async () => {
        setup({ balance: { spendingPower: 0 } })
        mockCancelCard.mockResolvedValue(stopped('pending'))
        mockGetCardFunding.mockResolvedValue(funding('pending'))
        renderCancel()
        fireEvent.click(screen.getByRole('button', { name: 'Slide to cancel' }))

        expect(await screen.findByText('Card canceled')).toBeInTheDocument()
        expect(await screen.findByText(/still in progress/)).toBeInTheDocument()
        expect(screen.queryByText(/are stopped/)).not.toBeInTheDocument()
        // the modal stays open on the notice until the user closes it
        expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument()
    })

    it('a failed status read keeps "Card canceled" and shows no failure', async () => {
        setup({ balance: { spendingPower: 0 } })
        mockCancelCard.mockResolvedValue(stopped('pending'))
        mockGetCardFunding.mockRejectedValue(new Error('offline'))
        renderCancel()
        fireEvent.click(screen.getByRole('button', { name: 'Slide to cancel' }))

        expect(await screen.findByText(/couldn't check yet/)).toBeInTheDocument()
        expect(screen.getByText('Card canceled')).toBeInTheDocument()
        expect(screen.queryByText(/Failed to cancel/)).not.toBeInTheDocument()
    })

    it('a retry after a failed attempt reuses the signed proof: no second signature', async () => {
        setup(OVERVIEW)
        mockCancelCard.mockRejectedValueOnce(new Error('gateway timeout')).mockResolvedValue(stopped('not_applicable'))
        renderCancel()
        fireEvent.click(screen.getByRole('button', { name: 'Slide to cancel' }))
        expect(await screen.findByText('gateway timeout')).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'Slide to cancel' }))
        expect(await screen.findByText('Card canceled')).toBeInTheDocument()
        expect(mockSignSpend).toHaveBeenCalledTimes(1)
        expect(mockCancelCard).toHaveBeenLastCalledWith('card-1', { verifiedWithdrawal: RAIN_WITHDRAWAL })
        // nothing managed for this wallet: no claim and no status read
        expect(mockGetCardFunding).not.toHaveBeenCalled()
    })
})

/**
 * What a lock or cancel did about the card balance (TASK-24511). The backend
 * sizes the return from the chain and reports it in `collateralReturn`. A
 * freeze is never refused, so a frozen card can still hold the balance and the
 * modal must say so; a cancel waits, with a code and a time, until the balance
 * is back. A backend that predates the field sends none of this, and the
 * modals behave as the tests above describe.
 */
const returned = (
    state: 'nothing' | 'returned' | 'required' | 'waiting' | 'failed' | 'unknown',
    cents: { remainingCents?: number; heldCents?: number; cardCreditCents?: number } = {}
) => ({
    state,
    returnedCents: state === 'returned' ? 1006 : 0,
    remainingCents: 0,
    heldCents: 0,
    cardCreditCents: 0,
    ...cents,
})
const LEFT_IN_CARD = '$20 is still in the card. Unfreeze the card to use it.'

describe('LockCardModal: balance left in the frozen card', () => {
    const lockWith = (collateralReturn: ReturnType<typeof returned>, stop = stopped('not_applicable')) => {
        setup({ balance: { spendingPower: 0 } })
        mockLockCard.mockResolvedValue({ ...stop, collateralReturn })
        renderLock()
        fireEvent.click(screen.getByText('Slide to freeze'))
    }

    it.each([
        ['there was nothing to move', returned('nothing')],
        ['the whole balance moved', returned('returned')],
        ['one cent stayed behind, which the provider cannot sign for', returned('returned', { remainingCents: 1 })],
    ])('says nothing when %s: plain success toast and close', async (_what, collateralReturn) => {
        lockWith(collateralReturn)
        await waitFor(() => expect(mockOnClose).toHaveBeenCalledTimes(1))
        expect(mockToastSuccess).toHaveBeenCalledWith('Card frozen')
    })

    it.each([
        ['no signed return reached the backend', returned('required', { remainingCents: 2000 })],
        ['the provider holds the balance back', returned('waiting', { remainingCents: 2000 })],
        ['the signed return failed', returned('failed', { remainingCents: 2000 })],
        ['only part of the balance moved', returned('returned', { remainingCents: 2000 })],
    ])('the card is frozen but %s: shows the amount left, no plain success', async (_what, collateralReturn) => {
        lockWith(collateralReturn)

        expect(await screen.findByText(LEFT_IN_CARD)).toBeInTheDocument()
        expect(screen.getByText('Card frozen')).toBeInTheDocument()
        expect(mockToastSuccess).not.toHaveBeenCalled()
        expect(mockOnClose).not.toHaveBeenCalled()
        // the card did freeze: the overview is refreshed and no failure is shown
        expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['rain-card-overview'] })
        expect(screen.queryByText(/Failed to freeze/)).not.toBeInTheDocument()
    })

    it('an unreadable balance never reads as an empty card', async () => {
        lockWith(returned('unknown'))

        expect(await screen.findByText(/couldn't confirm that the card balance moved/)).toBeInTheDocument()
        expect(screen.getByText('Card frozen')).toBeInTheDocument()
        expect(mockToastSuccess).not.toHaveBeenCalled()
    })

    it('names what is reserved for pending payments and what is refund credit', async () => {
        lockWith(returned('returned', { heldCents: 550, cardCreditCents: 1234 }))

        expect(await screen.findByText('$5.50 stays in the card for pending payments.')).toBeInTheDocument()
        expect(screen.getByText('$12.34 is refund credit. Unfreeze the card to spend it.')).toBeInTheDocument()
        expect(screen.queryByText(/is still in the card/)).not.toBeInTheDocument()
    })

    it('shows the balance left next to the wallet payment stop, not in place of it', async () => {
        mockGetCardFunding.mockResolvedValue(funding('pending'))
        lockWith(returned('waiting', { remainingCents: 2000 }), stopped('pending'))

        expect(await screen.findByText(LEFT_IN_CARD)).toBeInTheDocument()
        expect(await screen.findByText(/still in progress/)).toBeInTheDocument()
    })

    it('a signed return the backend already used is not sent again: the retry signs anew', async () => {
        setup(OVERVIEW)
        mockLockCard
            .mockRejectedValueOnce(new ApiError('Intent already completed', { status: 409 }))
            .mockResolvedValue(stopped('not_applicable'))
        renderLock()
        fireEvent.click(screen.getByText('Slide to freeze'))
        expect(await screen.findByText('Intent already completed')).toBeInTheDocument()

        fireEvent.click(screen.getByText('Slide to freeze'))
        await waitFor(() => expect(mockOnClose).toHaveBeenCalledTimes(1))
        expect(mockSignSpend).toHaveBeenCalledTimes(2)
    })
})

describe('CancelCardModal: the cancel waits for the card balance', () => {
    const BACKEND_SENTENCE = 'Your card balance cannot be returned yet. Try again in 3 minutes.'
    const slide = () => screen.getByRole('button', { name: 'Slide to cancel' })
    const refusal = (code: string, status: number, retryAfterSec?: number) =>
        new ApiError(BACKEND_SENTENCE, { status, code, retryAfterSec })

    afterEach(() => jest.useRealTimers())

    it('CARD_RETURN_BLOCKED: counts down in its own words, holds the slide, then signs for the fresh balance', async () => {
        jest.useFakeTimers()
        // The open signature made the balance on screen read zero, so nothing was signed.
        setup({ balance: { spendingPower: 0 } })
        mockCancelCard
            .mockRejectedValueOnce(refusal('CARD_RETURN_BLOCKED', 409, 150))
            .mockResolvedValue(stopped('not_applicable'))
        renderCancel()
        fireEvent.click(slide())

        expect(
            await screen.findByText("The card balance can't move to the wallet yet. Try again in 2:30.")
        ).toBeInTheDocument()
        expect(screen.queryByText(BACKEND_SENTENCE)).not.toBeInTheDocument()
        expect(slide()).toBeDisabled()
        expect(mockSignSpend).not.toHaveBeenCalled()

        await act(async () => {
            await jest.advanceTimersByTimeAsync(149_000)
        })
        expect(slide()).toBeDisabled()
        await act(async () => {
            await jest.advanceTimersByTimeAsync(2_000)
        })
        expect(screen.getByText('The card balance can move now. Try again.')).toBeInTheDocument()
        expect(slide()).toBeEnabled()

        // The provider released the balance: the retry reads it again and signs for it.
        mockRefetchOverview.mockResolvedValue({ data: { balance: { spendingPower: 2000 } } })
        fireEvent.click(slide())
        expect(await screen.findByText('Card canceled')).toBeInTheDocument()
        expect(mockRefetchOverview).toHaveBeenCalledTimes(1)
        expect(mockSignSpend).toHaveBeenCalledWith({
            ...FORCED_SIGN_ARGS,
            requiredUsdcAmount: 20_000_000n,
            rainSpendingPower: 20_000_000n,
        })
        expect(mockCancelCard).toHaveBeenLastCalledWith('card-1', { verifiedWithdrawal: RAIN_WITHDRAWAL })
    })

    it('CARD_BALANCE_REMAINS: says part moved, and never sends the used signature again', async () => {
        jest.useFakeTimers()
        setup(OVERVIEW)
        mockCancelCard
            .mockRejectedValueOnce(refusal('CARD_BALANCE_REMAINS', 409, 163))
            .mockResolvedValue(stopped('not_applicable'))
        renderCancel()
        fireEvent.click(slide())

        expect(
            await screen.findByText('Part of the card balance moved to the wallet. The rest can move in 2:43.')
        ).toBeInTheDocument()
        expect(screen.queryByText(BACKEND_SENTENCE)).not.toBeInTheDocument()
        expect(slide()).toBeDisabled()

        await act(async () => {
            await jest.advanceTimersByTimeAsync(164_000)
        })
        // What is left is $4.00: the retry signs for that, not for the first amount again.
        mockRefetchOverview.mockResolvedValue({ data: { balance: { spendingPower: 400 } } })
        fireEvent.click(slide())
        expect(await screen.findByText('Card canceled')).toBeInTheDocument()
        expect(mockSignSpend).toHaveBeenCalledTimes(2)
        expect(mockSignSpend).toHaveBeenLastCalledWith({
            ...FORCED_SIGN_ARGS,
            requiredUsdcAmount: 4_000_000n,
            rainSpendingPower: 4_000_000n,
        })
    })

    it('CARD_BALANCE_UNREADABLE: asks to try again, keeps the unused signature and holds nothing', async () => {
        setup(OVERVIEW)
        mockCancelCard
            .mockRejectedValueOnce(refusal('CARD_BALANCE_UNREADABLE', 502))
            .mockResolvedValue(stopped('not_applicable'))
        renderCancel()
        fireEvent.click(slide())

        expect(await screen.findByText("We couldn't read your card balance. Try again.")).toBeInTheDocument()
        expect(screen.queryByText(BACKEND_SENTENCE)).not.toBeInTheDocument()
        expect(slide()).toBeEnabled()

        fireEvent.click(slide())
        expect(await screen.findByText('Card canceled')).toBeInTheDocument()
        // the backend did not run the signed return, so the same one goes again
        expect(mockSignSpend).toHaveBeenCalledTimes(1)
        expect(mockCancelCard).toHaveBeenLastCalledWith('card-1', { verifiedWithdrawal: RAIN_WITHDRAWAL })
    })

    it('a wait with no time from the backend invents no countdown and does not hold the slide', async () => {
        setup({ balance: { spendingPower: 0 } })
        mockCancelCard.mockRejectedValueOnce(refusal('CARD_RETURN_BLOCKED', 409))
        renderCancel()
        fireEvent.click(slide())

        expect(await screen.findByText('Your card balance cannot move right now. Try again later.')).toBeInTheDocument()
        expect(screen.queryByText(BACKEND_SENTENCE)).not.toBeInTheDocument()
        expect(slide()).toBeEnabled()
    })

    it('a wait outlives closing the modal: reopening still holds the slide', async () => {
        jest.useFakeTimers()
        setup({ balance: { spendingPower: 0 } })
        mockCancelCard.mockRejectedValueOnce(refusal('CARD_RETURN_BLOCKED', 409, 150))
        const { rerender } = renderCancel()
        fireEvent.click(slide())
        expect(await screen.findByText(/Try again in 2:30/)).toBeInTheDocument()

        rerender(<CancelCardModal cardId="card-1" isOpen={false} onClose={jest.fn()} />)
        await act(async () => {
            await jest.advanceTimersByTimeAsync(30_000)
        })
        rerender(<CancelCardModal cardId="card-1" isOpen onClose={jest.fn()} />)
        expect(await screen.findByText(/Try again in 2:00/)).toBeInTheDocument()
        expect(slide()).toBeDisabled()
    })

    it('after the cancel, names what stays for pending payments and what is refund credit', async () => {
        setup({ balance: { spendingPower: 0 } })
        mockCancelCard.mockResolvedValue({
            ...stopped('not_applicable'),
            status: 'CANCELED',
            collateralReturn: returned('nothing', { heldCents: 550, cardCreditCents: 1234 }),
        })
        renderCancel()
        fireEvent.click(slide())

        expect(await screen.findByText('Card canceled')).toBeInTheDocument()
        expect(screen.getByText('$5.50 stays in the card for pending payments.')).toBeInTheDocument()
        expect(screen.getByText('$12.34 is refund credit. Spend it with a new card.')).toBeInTheDocument()
        // the modal stays open on the notice until the user closes it
        expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument()
    })

    it('a retry whose balance read fails signs nothing: the figure on screen predates the partial return', async () => {
        jest.useFakeTimers()
        setup(OVERVIEW)
        mockCancelCard
            .mockRejectedValueOnce(refusal('CARD_BALANCE_REMAINS', 409, 163))
            .mockResolvedValue(stopped('not_applicable'))
        renderCancel()
        fireEvent.click(slide())
        expect(await screen.findByText(/The rest can move in 2:43/)).toBeInTheDocument()
        await act(async () => {
            await jest.advanceTimersByTimeAsync(164_000)
        })

        // The read fails, and the cache still holds the $10.06 from before the return.
        mockRefetchOverview.mockResolvedValueOnce({ data: OVERVIEW, isError: true })
        fireEvent.click(slide())
        expect(await screen.findByText("We couldn't read your card balance. Try again.")).toBeInTheDocument()
        expect(mockSignSpend).toHaveBeenCalledTimes(1)
        expect(mockCancelCard).toHaveBeenCalledTimes(1)

        // The next read succeeds: the retry signs for what is left.
        mockRefetchOverview.mockResolvedValue({ data: { balance: { spendingPower: 400 } }, isError: false })
        fireEvent.click(slide())
        expect(await screen.findByText('Card canceled')).toBeInTheDocument()
        expect(mockSignSpend).toHaveBeenLastCalledWith({
            ...FORCED_SIGN_ARGS,
            requiredUsdcAmount: 4_000_000n,
            rainSpendingPower: 4_000_000n,
        })
    })

    it('a backend without the codes keeps its own sentence, and the refused signature is not sent again', async () => {
        setup(OVERVIEW)
        mockCancelCard
            .mockRejectedValueOnce(new ApiError('Withdrawal amount must equal full spending power', { status: 400 }))
            .mockResolvedValue(stopped('not_applicable'))
        renderCancel()
        fireEvent.click(slide())
        expect(await screen.findByText('Withdrawal amount must equal full spending power')).toBeInTheDocument()
        expect(slide()).toBeEnabled()

        fireEvent.click(slide())
        expect(await screen.findByText('Card canceled')).toBeInTheDocument()
        expect(mockRefetchOverview).toHaveBeenCalledTimes(1)
        expect(mockSignSpend).toHaveBeenCalledTimes(2)
    })
})

/**
 * Cancelling is an ordinary cancel. The card funding permission is Peanut's to
 * manage: the person is offered no step to remove it, and cancelling never
 * reads or changes it.
 */
describe('CancelCardModal — no permission removal step', () => {
    it('ends on "Card canceled", with no removal offer', async () => {
        setup({ balance: { spendingPower: 0 } })
        renderCancel()
        fireEvent.click(screen.getByRole('button', { name: /slide to cancel/i }))

        expect(await screen.findByText('Card canceled')).toBeInTheDocument()
        expect(mockCancelCard).toHaveBeenCalledTimes(1)
        expect(screen.queryByRole('button', { name: /remove permission|not now/i })).not.toBeInTheDocument()
        expect(screen.queryByText(/permission/i)).not.toBeInTheDocument()
        // the cancel flow reads no funding state and no card list beyond the overview
        expect(mockGetOverview).not.toHaveBeenCalled()
    })
})

/**
 * A lock retry. After a failed attempt the balance on screen can predate a
 * return that already ran, so a retry that needs a new signature reads the
 * balance again and sizes from that. A freeze is never refused: when the read
 * fails the retry signs nothing and still freezes the card, and the backend
 * says what stayed in it. A saved proof that is still valid goes first.
 */
describe('LockCardModal: a retry after a failed freeze', () => {
    const slide = () => fireEvent.click(screen.getByText('Slide to freeze'))
    const spent = new ApiError('Intent already completed', { status: 409 })

    afterEach(() => jest.useRealTimers())

    it('the first attempt reads nothing extra', async () => {
        setup(OVERVIEW)
        renderLock()
        slide()
        await waitFor(() => expect(mockOnClose).toHaveBeenCalledTimes(1))
        expect(mockRefetchOverview).not.toHaveBeenCalled()
    })

    it('signs for the fresh balance, not for the one on screen', async () => {
        setup(OVERVIEW)
        mockLockCard.mockRejectedValueOnce(spent).mockResolvedValue(stopped('not_applicable'))
        renderLock()
        slide()
        expect(await screen.findByText('Intent already completed')).toBeInTheDocument()

        // $10.06 was on screen; the return that ran left $4.00.
        mockRefetchOverview.mockResolvedValue({ data: { balance: { spendingPower: 400 } }, isError: false })
        slide()
        await waitFor(() => expect(mockOnClose).toHaveBeenCalledTimes(1))
        expect(mockRefetchOverview).toHaveBeenCalledTimes(1)
        expect(mockSignSpend).toHaveBeenCalledTimes(2)
        expect(mockSignSpend).toHaveBeenLastCalledWith({
            ...FORCED_SIGN_ARGS,
            requiredUsdcAmount: 4_000_000n,
            rainSpendingPower: 4_000_000n,
        })
    })

    it('a read that fails signs nothing, still freezes, and shows what the backend says is left', async () => {
        setup(OVERVIEW)
        mockLockCard.mockRejectedValueOnce(spent).mockResolvedValue({
            ...stopped('not_applicable'),
            collateralReturn: returned('required', { remainingCents: 2000 }),
        })
        renderLock()
        slide()
        expect(await screen.findByText('Intent already completed')).toBeInTheDocument()

        // The read fails and the cache still holds the figure from before the return.
        mockRefetchOverview.mockResolvedValue({ data: OVERVIEW, isError: true })
        slide()
        expect(await screen.findByText(LEFT_IN_CARD)).toBeInTheDocument()
        expect(screen.getByText('Card frozen')).toBeInTheDocument()
        expect(mockSignSpend).toHaveBeenCalledTimes(1)
        expect(mockLockCard).toHaveBeenLastCalledWith('card-1', undefined)
        expect(screen.queryByText(/couldn't read your card balance/)).not.toBeInTheDocument()
    })

    it('the return landed, the status change failed, the proof expired: the retry only freezes', async () => {
        jest.useFakeTimers()
        setup(OVERVIEW)
        mockSignSpend.mockResolvedValue({
            strategy: 'collateral-only',
            rainWithdrawal: { ...RAIN_WITHDRAWAL, expiresAt: Math.floor(Date.now() / 1000) + 300 },
        })
        mockLockCard
            .mockRejectedValueOnce(new ApiError('Card update failed', { status: 500 }))
            .mockResolvedValue(stopped('not_applicable'))
        renderLock()
        slide()
        expect(await screen.findByText('Card update failed')).toBeInTheDocument()

        await act(async () => {
            await jest.advanceTimersByTimeAsync(301_000)
        })
        // Nothing is left to return, so nothing is signed again.
        mockRefetchOverview.mockResolvedValue({ data: { balance: { spendingPower: 0 } }, isError: false })
        slide()
        await waitFor(() => expect(mockOnClose).toHaveBeenCalledTimes(1))
        expect(mockSignSpend).toHaveBeenCalledTimes(1)
        expect(mockLockCard).toHaveBeenLastCalledWith('card-1', undefined)
    })

    it('a saved proof that is still valid goes first: no new read, no new signature', async () => {
        setup(OVERVIEW)
        mockLockCard
            .mockRejectedValueOnce(new ApiError('Card update failed', { status: 500 }))
            .mockResolvedValue(stopped('not_applicable'))
        renderLock()
        slide()
        expect(await screen.findByText('Card update failed')).toBeInTheDocument()

        slide()
        await waitFor(() => expect(mockOnClose).toHaveBeenCalledTimes(1))
        expect(mockRefetchOverview).not.toHaveBeenCalled()
        expect(mockSignSpend).toHaveBeenCalledTimes(1)
        expect(mockLockCard).toHaveBeenLastCalledWith('card-1', RAIN_WITHDRAWAL)
    })

    it('a failed unfreeze retries as before: no balance read, nothing signed', async () => {
        setup(OVERVIEW)
        mockActivateCard
            .mockRejectedValueOnce(new ApiError('Card update failed', { status: 500 }))
            .mockResolvedValue({ status: 'ACTIVE', fundingStop: { state: 'resumed', reason: null } })
        renderUnlock()
        fireEvent.click(screen.getByRole('button', { name: 'Unfreeze' }))
        expect(await screen.findByText('Card update failed')).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'Unfreeze' }))
        await waitFor(() => expect(mockOnClose).toHaveBeenCalledTimes(1))
        expect(mockRefetchOverview).not.toHaveBeenCalled()
        expect(mockSignSpend).not.toHaveBeenCalled()
    })
})

/**
 * What a lock or cancel signs for. A merchant refund raises spending power and
 * adds nothing on-chain, so the full spending power can be more than the card
 * holds: the provider refused to sign, and the freeze or cancel never reached
 * the backend. The amount is the smaller of spending power and the credit
 * limit, which is the provider's count of the collateral.
 */
describe.each([
    {
        modal: 'lock',
        slideAndWait: async () => {
            renderLock()
            fireEvent.click(screen.getByText('Slide to freeze'))
            await waitFor(() => expect(mockLockCard).toHaveBeenCalledTimes(1))
        },
        api: mockLockCard,
        sentWith: (proof?: typeof RAIN_WITHDRAWAL) => ['card-1', proof],
        creditLine: '$12.34 is refund credit. Unfreeze the card to spend it.',
    },
    {
        modal: 'cancel',
        slideAndWait: async () => {
            renderCancel()
            fireEvent.click(screen.getByRole('button', { name: 'Slide to cancel' }))
            await waitFor(() => expect(mockCancelCard).toHaveBeenCalledTimes(1))
        },
        api: mockCancelCard,
        sentWith: (proof?: typeof RAIN_WITHDRAWAL) => ['card-1', { verifiedWithdrawal: proof }],
        creditLine: '$12.34 is refund credit. Spend it with a new card.',
    },
])('$modal: the amount signed for the card balance return', ({ slideAndWait, api, sentWith, creditLine }) => {
    it.each([
        ['refund credit above the card balance: what the card holds', 3000, 2000, 20_000_000n],
        ['no refund credit: the spending power, as before', 1006, 1006, 10_060_000n],
        ['refund credit while an open signature lowers both numbers', 2500, 1500, 15_000_000n],
        ['no refund credit while an open signature lowers both numbers', 1500, 1500, 15_000_000n],
        ['a credit limit above the spending power (pending charges): the spending power', 1006, 5000, 10_060_000n],
    ])('%s', async (_what, spendingPower, creditLimit, signedUnits) => {
        setup({ balance: { spendingPower, creditLimit } })
        await slideAndWait()

        expect(mockSignSpend).toHaveBeenCalledTimes(1)
        expect(mockSignSpend).toHaveBeenCalledWith({
            ...FORCED_SIGN_ARGS,
            requiredUsdcAmount: signedUnits,
            // the preflight still checks the signed amount against the real spending power
            rainSpendingPower: BigInt(spendingPower) * 10_000n,
        })
        expect(api).toHaveBeenCalledWith(...sentWith(RAIN_WITHDRAWAL))
    })

    it('only refund credit is left: signs nothing, still sends the action, and shows the credit it reports', async () => {
        setup({ balance: { spendingPower: 1234, creditLimit: 0 } })
        api.mockResolvedValue({
            ...stopped('not_applicable'),
            collateralReturn: returned('nothing', { cardCreditCents: 1234 }),
        })
        await slideAndWait()

        expect(mockSignSpend).not.toHaveBeenCalled()
        expect(api).toHaveBeenCalledWith(...sentWith(undefined))
        expect(await screen.findByText(creditLine)).toBeInTheDocument()
    })

    it.each([
        ['absent', undefined],
        ['not a number', NaN],
        ['negative', -1],
    ])('a credit limit that is %s says nothing: the spending power decides', async (_what, creditLimit) => {
        setup({ balance: { spendingPower: 1006, creditLimit } })
        await slideAndWait()

        expect(mockSignSpend).toHaveBeenCalledWith(FORCED_SIGN_ARGS)
        expect(api).toHaveBeenCalledWith(...sentWith(RAIN_WITHDRAWAL))
    })
})

/**
 * The cancel ends on "Card canceled". It asks for no reason: the modal stays
 * open, so the notices can be read, and Close is its only action. The card
 * screen is refreshed only then, because the refresh unmounts this modal.
 */
describe('CancelCardModal: after the cancel', () => {
    const cancelNow = async (onClose = jest.fn()) => {
        setup({ balance: { spendingPower: 0 } })
        render(<CancelCardModal cardId="card-1" isOpen onClose={onClose} />, { wrapper: Wrapper })
        fireEvent.click(screen.getByRole('button', { name: 'Slide to cancel' }))
        expect(await screen.findByText('Card canceled')).toBeInTheDocument()
        return onClose
    }

    it('asks for no cancel reason and offers Close alone', async () => {
        await cancelNow()

        expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
        expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual(['Close'])
        expect(screen.getByText(/It can no longer be used for payments/)).toBeInTheDocument()
    })

    it('stays open until Close, and refreshes the card screen only then', async () => {
        const onClose = await cancelNow()
        expect(onClose).not.toHaveBeenCalled()
        expect(mockInvalidateQueries).not.toHaveBeenCalled()

        fireEvent.click(screen.getByRole('button', { name: 'Close' }))
        expect(onClose).toHaveBeenCalledTimes(1)
        expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['rain-card-overview'] })
    })

    it('a dismissed confirm step refreshes nothing: the card is unchanged', () => {
        setup(OVERVIEW)
        const onClose = jest.fn()
        render(<CancelCardModal cardId="card-1" isOpen onClose={onClose} />, { wrapper: Wrapper })
        fireEvent.click(screen.getByRole('button', { name: 'Keep card' }))

        expect(onClose).toHaveBeenCalledTimes(1)
        expect(mockInvalidateQueries).not.toHaveBeenCalled()
    })
})
