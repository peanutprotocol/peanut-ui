/**
 * useClaimSuccessPolling — replaces the bare 250ms setInterval that stacked
 * concurrent GETs (89 in one Android session). The contract under test:
 * requests never overlap, polling stops on a terminal result or at the
 * attempt cap, and the result callbacks fire exactly once.
 */
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

const mockGet = jest.fn()
jest.mock('@/services/sendLinks', () => ({
    sendLinksApi: { get: mockGet },
    ESendLinkStatus: {
        creating: 'creating',
        completed: 'completed',
        CLAIMING: 'CLAIMING',
        CLAIMED: 'CLAIMED',
        CANCELLED: 'CANCELLED',
        FAILED: 'FAILED',
    },
}))

// must come after the jest.mock calls above
import { useClaimSuccessPolling, CLAIM_POLL_INTERVAL_MS, MAX_CLAIM_POLL_ATTEMPTS } from '../useClaimSuccessPolling'

const LINK = 'https://peanut.me/claim?c=8453&v=v4.4&i=1#p=secret'

describe('useClaimSuccessPolling', () => {
    let queryClient: QueryClient

    beforeEach(() => {
        jest.useFakeTimers()
        queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
        mockGet.mockReset()
    })

    afterEach(() => {
        queryClient.clear()
        jest.useRealTimers()
    })

    const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )

    const renderPolling = ({ onClaimed = jest.fn(), onFailed = jest.fn(), enabled = true } = {}) => ({
        onClaimed,
        onFailed,
        ...renderHook(() => useClaimSuccessPolling(LINK, enabled, onClaimed, onFailed), { wrapper }),
    })

    const advance = async (ms: number) => {
        await act(async () => {
            await jest.advanceTimersByTimeAsync(ms)
        })
    }

    it('never overlaps requests while a response hangs', async () => {
        mockGet.mockImplementation(() => new Promise(() => {})) // hangs forever
        renderPolling()

        await advance(10 * CLAIM_POLL_INTERVAL_MS)

        expect(mockGet).toHaveBeenCalledTimes(1)
    })

    it('polls at the interval, then stops and reports the tx hash once on claim', async () => {
        mockGet
            .mockResolvedValueOnce({ status: 'CLAIMING', events: [] })
            .mockResolvedValue({ status: 'CLAIMED', claim: { txHash: '0xabc' }, events: [] })
        const { onClaimed, onFailed, rerender } = renderPolling()

        await advance(0)
        expect(mockGet).toHaveBeenCalledTimes(1)
        expect(onClaimed).not.toHaveBeenCalled()

        await advance(CLAIM_POLL_INTERVAL_MS)
        await advance(1) // flush the batched observer notify through to the effect
        expect(mockGet).toHaveBeenCalledTimes(2)
        expect(onClaimed).toHaveBeenCalledTimes(1)
        expect(onClaimed).toHaveBeenCalledWith('0xabc')

        // terminal — no further polls, callback stays one-shot
        await advance(10 * CLAIM_POLL_INTERVAL_MS)
        rerender()
        expect(mockGet).toHaveBeenCalledTimes(2)
        expect(onClaimed).toHaveBeenCalledTimes(1)
        expect(onFailed).not.toHaveBeenCalled()
    })

    it('stops and reports the failure reason once on FAILED', async () => {
        mockGet.mockResolvedValue({ status: 'FAILED', events: [{ status: 'FAILED', reason: 'out of gas' }] })
        const { onClaimed, onFailed } = renderPolling()

        await advance(0)
        expect(onFailed).toHaveBeenCalledTimes(1)
        expect(onFailed).toHaveBeenCalledWith('out of gas')

        await advance(10 * CLAIM_POLL_INTERVAL_MS)
        expect(mockGet).toHaveBeenCalledTimes(1)
        expect(onFailed).toHaveBeenCalledTimes(1)
        expect(onClaimed).not.toHaveBeenCalled()
    })

    it('gives up at the attempt cap when the link never resolves (404 while indexing)', async () => {
        mockGet.mockRejectedValue(new Error('HTTP error! status: 404'))
        const { onClaimed, onFailed } = renderPolling()

        await advance((MAX_CLAIM_POLL_ATTEMPTS + 10) * CLAIM_POLL_INTERVAL_MS)

        expect(mockGet).toHaveBeenCalledTimes(MAX_CLAIM_POLL_ATTEMPTS)
        expect(onClaimed).not.toHaveBeenCalled()
        expect(onFailed).not.toHaveBeenCalled()
    })

    it('does not poll when disabled (tx hash already known)', async () => {
        mockGet.mockResolvedValue({ status: 'CLAIMED', claim: { txHash: '0xabc' }, events: [] })
        renderPolling({ enabled: false })

        await advance(5 * CLAIM_POLL_INTERVAL_MS)

        expect(mockGet).not.toHaveBeenCalled()
    })

    it('stops polling on unmount', async () => {
        mockGet.mockResolvedValue({ status: 'CLAIMING', events: [] })
        const { unmount } = renderPolling()

        await advance(CLAIM_POLL_INTERVAL_MS)
        const callsBeforeUnmount = mockGet.mock.calls.length
        expect(callsBeforeUnmount).toBeGreaterThan(0)

        unmount()
        await advance(10 * CLAIM_POLL_INTERVAL_MS)
        expect(mockGet).toHaveBeenCalledTimes(callsBeforeUnmount)
    })
})
