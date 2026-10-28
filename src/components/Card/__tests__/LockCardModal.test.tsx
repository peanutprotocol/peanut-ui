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
        submitCancellationFeedback: jest.fn(),
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
        fireEvent.click(screen.getByText('Slide to Lock'))
        await waitFor(() => expect(mockOnClose).toHaveBeenCalledTimes(1))
        expect(mockToastSuccess).toHaveBeenCalledWith('Card locked')
        expect(mockSignSpend).toHaveBeenCalledWith(FORCED_SIGN_ARGS)
        expect(mockLockCard).toHaveBeenCalledWith('card-1', RAIN_WITHDRAWAL)
        // a lock is reversible — it reads no card list beyond the overview
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

/**
 * Wallet payments stop with the card (TASK-22887). The lock/cancel response says
 * the CARD is done; "payments stopped" is shown only when the live funding read
 * confirms it. Pending, unavailable and an unreadable status never claim it.
 */
describe('LockCardModal — wallet payment stop', () => {
    const lockNow = async () => {
        setup({ balance: { spendingPower: 0 } })
        renderLock()
        fireEvent.click(screen.getByText('Slide to Lock'))
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
        expect(screen.getByText('Card locked')).toBeInTheDocument()
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
        expect(screen.getByText('Card locked')).toBeInTheDocument()
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
        expect(mockToastSuccess).toHaveBeenCalledWith('Card locked')
        expect(mockGetCardFunding).not.toHaveBeenCalled()
    })

    it('a retry after a failed attempt reuses the signed proof: no second signature', async () => {
        setup(OVERVIEW)
        mockLockCard.mockRejectedValueOnce(new Error('gateway timeout')).mockResolvedValue(stopped('not_applicable'))
        renderLock()
        fireEvent.click(screen.getByText('Slide to Lock'))
        expect(await screen.findByText('gateway timeout')).toBeInTheDocument()

        fireEvent.click(screen.getByText('Slide to Lock'))
        await waitFor(() => expect(mockOnClose).toHaveBeenCalledTimes(1))
        expect(mockSignSpend).toHaveBeenCalledTimes(1)
        expect(mockLockCard).toHaveBeenCalledTimes(2)
        expect(mockLockCard).toHaveBeenLastCalledWith('card-1', RAIN_WITHDRAWAL)
    })

    it('closing and reopening after a failed attempt still reuses the signed proof', async () => {
        setup(OVERVIEW)
        mockLockCard.mockRejectedValueOnce(new Error('gateway timeout')).mockResolvedValue(stopped('not_applicable'))
        const { rerender } = renderLock()
        fireEvent.click(screen.getByText('Slide to Lock'))
        expect(await screen.findByText('gateway timeout')).toBeInTheDocument()

        rerender(<LockCardModal cardId="card-1" mode="lock" isOpen={false} onClose={mockOnClose} />)
        rerender(<LockCardModal cardId="card-1" mode="lock" isOpen onClose={mockOnClose} />)
        fireEvent.click(screen.getByText('Slide to Lock'))
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
        fireEvent.click(screen.getByText('Slide to Lock'))
        expect(await screen.findByText('expired')).toBeInTheDocument()

        fireEvent.click(screen.getByText('Slide to Lock'))
        await waitFor(() => expect(mockOnClose).toHaveBeenCalledTimes(1))
        expect(mockSignSpend).toHaveBeenCalledTimes(2)
    })
})

describe('LockCardModal — unlock', () => {
    it('keeps the modal open and says payments stay stopped when the backend kept the stop', async () => {
        setup(OVERVIEW)
        mockActivateCard.mockResolvedValue({ status: 'ACTIVE', fundingStop: { state: 'kept', reason: 'paused' } })
        renderUnlock()
        fireEvent.click(screen.getByRole('button', { name: 'Unlock' }))

        expect(await screen.findByText(/payments from your wallet stay stopped for now/)).toBeInTheDocument()
        expect(screen.getByText('Card unlocked')).toBeInTheDocument()
        expect(mockOnClose).not.toHaveBeenCalled()
        expect(mockGetCardFunding).not.toHaveBeenCalled()
    })

    it('a lift the backend could not finish (fundingStop null) is not "done": same notice, Unlock retries, nothing is withdrawn', async () => {
        setup(OVERVIEW)
        mockActivateCard
            .mockResolvedValueOnce({ status: 'ACTIVE', fundingStop: null })
            .mockResolvedValueOnce({ status: 'ACTIVE', fundingStop: { state: 'resumed', reason: null } })
        renderUnlock()
        fireEvent.click(screen.getByRole('button', { name: 'Unlock' }))

        expect(await screen.findByText(/couldn't confirm that payments from your wallet resumed/)).toBeInTheDocument()
        expect(mockOnClose).not.toHaveBeenCalled()
        expect(mockToastSuccess).not.toHaveBeenCalled()

        fireEvent.click(screen.getByRole('button', { name: 'Unlock' }))
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
            fireEvent.click(screen.getByRole('button', { name: 'Unlock' }))

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
        fireEvent.click(screen.getByText('Slide to Lock'))
        expect(await screen.findByText('another action is running')).toBeInTheDocument()

        fireEvent.click(screen.getByText('Slide to Lock'))
        await waitFor(() => expect(mockOnClose).toHaveBeenCalledTimes(1))
        expect(mockSignSpend).toHaveBeenCalledTimes(1)
    })

    it('a resumed stop closes with the plain success toast and claims nothing about payments', async () => {
        setup(OVERVIEW)
        mockActivateCard.mockResolvedValue({ status: 'ACTIVE', fundingStop: { state: 'resumed', reason: null } })
        renderUnlock()
        fireEvent.click(screen.getByRole('button', { name: 'Unlock' }))

        await waitFor(() => expect(mockOnClose).toHaveBeenCalledTimes(1))
        expect(mockToastSuccess).toHaveBeenCalledWith('Card unlocked')
        expect(screen.queryByText(/wallet/)).not.toBeInTheDocument()
    })

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
        // the feedback step is still offered
        expect(screen.getByPlaceholderText('Why cancel?')).toBeInTheDocument()
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
 * Cancelling is an ordinary cancel. The card funding permission is Peanut's to
 * manage: the person is offered no step to remove it, and cancelling never
 * reads or changes it.
 */
describe('CancelCardModal — no permission removal step', () => {
    it('goes straight from the cancel to the feedback step, with no removal offer', async () => {
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
