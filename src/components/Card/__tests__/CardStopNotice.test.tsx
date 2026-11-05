/**
 * Real React Query, mocked network: the wallet payment stop is confirmed only by
 * a funding read made for THIS action attempt (its own query key, no cached or
 * shared answer), for the current account and wallet. An older cached read, the
 * same clock millisecond, another account's late request or a later second stop
 * can never confirm it.
 */
import React, { type ReactNode } from 'react'
import { render, screen, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { IntlWrapper } from '@/test-utils/intl'
import CardStopNotice from '@/components/Card/CardStopNotice'
import CardStopBanner from '@/components/Card/CardStopBanner'
import { rainApi, type CardFundingStop } from '@/services/rain'

const WALLET = '0xafbea1a6a6036d7d827e08072cd4315248b77352'
let mockUserId = 'user-a'

jest.mock('@/context/authContext', () => ({ useAuth: () => ({ user: { user: { userId: mockUserId } } }) }))
jest.mock('@/services/rain', () => ({ rainApi: { getCardFunding: jest.fn() } }))

const mockGetCardFunding = rainApi.getCardFunding as jest.Mock
const STOPPED = /Payments from your wallet to this card are stopped/
const IN_PROGRESS = /still in progress/

const read = (state: 'pending' | 'confirmed' | 'unavailable' | null, over: Record<string, unknown> = {}) => ({
    walletAddress: WALLET,
    management: { stop: state && { cause: 'card_locked', state } },
    ...over,
})
const deferred = <T,>() => {
    let resolve!: (v: T) => void
    const promise = new Promise<T>((r) => (resolve = r))
    return { promise, resolve }
}
const pendingStop: CardFundingStop = { state: 'pending', reason: 'card_locked' }

let client: QueryClient
const Wrapper = ({ children }: { children: ReactNode }) => (
    <IntlWrapper>
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </IntlWrapper>
)
const notice = (attemptId = 'attempt-1', over: Partial<React.ComponentProps<typeof CardStopNotice>> = {}) => (
    <CardStopNotice key={attemptId} stop={pendingStop} attemptId={attemptId} wallet={WALLET} {...over} />
)

beforeEach(() => {
    jest.clearAllMocks()
    mockUserId = 'user-a'
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
})

describe('CardStopNotice — what can confirm a stop', () => {
    it('a cached "confirmed" for the same account, even from this very millisecond, is never shown for a new attempt', async () => {
        // The shared funding entry already says confirmed, updated right now.
        client.setQueryData(['rain-card-funding', 'user-a'], read('confirmed'), { updatedAt: Date.now() })
        const fresh = deferred<unknown>()
        mockGetCardFunding.mockReturnValue(fresh.promise)
        render(notice(), { wrapper: Wrapper })

        expect(screen.getByText(IN_PROGRESS)).toBeInTheDocument()
        expect(screen.queryByText(STOPPED)).not.toBeInTheDocument()

        await act(async () => fresh.resolve(read('confirmed')))
        expect(await screen.findByText(STOPPED)).toBeInTheDocument()
    })

    it('a second stop after an earlier confirmed one starts unconfirmed (its own attempt, its own read)', async () => {
        mockGetCardFunding.mockResolvedValue(read('confirmed'))
        const { rerender } = render(notice('attempt-1'), { wrapper: Wrapper })
        expect(await screen.findByText(STOPPED)).toBeInTheDocument()

        const second = deferred<unknown>()
        mockGetCardFunding.mockReturnValue(second.promise)
        rerender(notice('attempt-2'))
        expect(screen.queryByText(STOPPED)).not.toBeInTheDocument()
        expect(screen.getByText(IN_PROGRESS)).toBeInTheDocument()

        await act(async () => second.resolve(read('pending')))
        expect(screen.getByText(IN_PROGRESS)).toBeInTheDocument()
        expect(screen.queryByText(STOPPED)).not.toBeInTheDocument()
    })

    it("an account switch while mounted: the first account's late answer cannot confirm the second", async () => {
        const lateA = deferred<unknown>()
        mockGetCardFunding.mockReturnValueOnce(lateA.promise).mockResolvedValue(read('pending'))
        const { rerender } = render(notice(), { wrapper: Wrapper })
        await waitFor(() => expect(mockGetCardFunding).toHaveBeenCalledTimes(1))

        mockUserId = 'user-b'
        rerender(notice())
        await waitFor(() => expect(mockGetCardFunding).toHaveBeenCalledTimes(2))
        await act(async () => lateA.resolve(read('confirmed')))

        expect(screen.getByText(IN_PROGRESS)).toBeInTheDocument()
        expect(screen.queryByText(STOPPED)).not.toBeInTheDocument()
    })

    it('a confirmed read for another wallet is ignored', async () => {
        mockGetCardFunding.mockResolvedValue(
            read('confirmed', { walletAddress: '0x1111111111111111111111111111111111111111' })
        )
        render(notice(), { wrapper: Wrapper })
        await waitFor(() => expect(mockGetCardFunding).toHaveBeenCalled())
        expect(screen.getByText(IN_PROGRESS)).toBeInTheDocument()
        expect(screen.queryByText(STOPPED)).not.toBeInTheDocument()
    })

    it('the stop is wallet-wide: a confirmed read counts whoever holds the pause', async () => {
        mockGetCardFunding.mockResolvedValue({
            walletAddress: WALLET,
            management: { stop: { cause: 'paused', state: 'confirmed' } },
        })
        render(notice(), { wrapper: Wrapper })
        expect(await screen.findByText(STOPPED)).toBeInTheDocument()
    })

    it('after an unlock the backend could not finish, says so and claims nothing', () => {
        render(notice('attempt-3', { stop: null, unlock: 'unknown' }), { wrapper: Wrapper })
        expect(screen.getByText(/couldn't confirm that payments from your wallet resumed/)).toBeInTheDocument()
        expect(mockGetCardFunding).not.toHaveBeenCalled()
    })
})

describe('CardStopBanner — the card page keeps an unfinished stop visible', () => {
    it('follows the shared funding read, and goes away once confirmed', async () => {
        mockGetCardFunding.mockResolvedValue(read('pending'))
        render(<CardStopBanner enabled />, { wrapper: Wrapper })
        expect(await screen.findByTestId('card-stop-banner')).toHaveTextContent(IN_PROGRESS)

        mockGetCardFunding.mockResolvedValue(read('confirmed'))
        await act(async () => {
            await client.invalidateQueries({ queryKey: ['rain-card-funding'] })
        })
        await waitFor(() => expect(screen.queryByTestId('card-stop-banner')).not.toBeInTheDocument())
    })

    it('a failed read after a known pending stop keeps the banner, never reads as confirmed', async () => {
        mockGetCardFunding.mockResolvedValue(read('pending'))
        render(<CardStopBanner enabled />, { wrapper: Wrapper })
        expect(await screen.findByTestId('card-stop-banner')).toBeInTheDocument()

        mockGetCardFunding.mockRejectedValue(new Error('offline'))
        await act(async () => {
            await client.invalidateQueries({ queryKey: ['rain-card-funding'] })
        })
        expect(screen.getByTestId('card-stop-banner')).toHaveTextContent(IN_PROGRESS)
    })

    it('says it could not confirm for an unavailable stop, and stays silent when the very first read fails', async () => {
        mockGetCardFunding.mockResolvedValue(read('unavailable'))
        const { unmount } = render(<CardStopBanner enabled />, { wrapper: Wrapper })
        expect(await screen.findByText(/couldn't confirm/)).toBeInTheDocument()
        unmount()

        client.clear()
        mockGetCardFunding.mockRejectedValue(new Error('offline'))
        render(<CardStopBanner enabled />, { wrapper: Wrapper })
        await waitFor(() => expect(mockGetCardFunding).toHaveBeenCalled())
        expect(screen.queryByTestId('card-stop-banner')).not.toBeInTheDocument()
    })

    it('reads nothing when disabled', () => {
        render(<CardStopBanner enabled={false} />, { wrapper: Wrapper })
        expect(mockGetCardFunding).not.toHaveBeenCalled()
    })
})
