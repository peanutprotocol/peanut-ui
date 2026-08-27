/**
 * useClaimSuccessPolling — replaces the bare 250ms setInterval that stacked
 * concurrent GETs (89 in one Android session). The contract under test:
 * requests never overlap, CLAIMED without a projected claim keeps polling
 * (the status flips before the claim intent is projected), the cadence backs
 * off after the fast phase, and the ceiling surfaces through onGaveUp instead
 * of stopping silently. Callbacks are one-shot.
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
import {
    useClaimSuccessPolling,
    CLAIM_POLL_INTERVAL_MS,
    CLAIM_POLL_SLOW_INTERVAL_MS,
    FAST_CLAIM_POLL_ATTEMPTS,
    MAX_CLAIM_POLL_ATTEMPTS,
} from '../useClaimSuccessPolling'

const LINK = 'https://peanut.me/claim?c=8453&v=v4.4&i=1#p=secret'
const FAST_PHASE_MS = (FAST_CLAIM_POLL_ATTEMPTS - 1) * CLAIM_POLL_INTERVAL_MS
const SLOW_PHASE_MS = (MAX_CLAIM_POLL_ATTEMPTS - FAST_CLAIM_POLL_ATTEMPTS) * CLAIM_POLL_SLOW_INTERVAL_MS

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

    const renderPolling = ({
        onClaimed = jest.fn(),
        onFailed = jest.fn(),
        onGaveUp = jest.fn(),
        enabled = true,
    } = {}) => ({
        onClaimed,
        onFailed,
        onGaveUp,
        ...renderHook(() => useClaimSuccessPolling(LINK, enabled, onClaimed, onFailed, onGaveUp), { wrapper }),
    })

    const advance = async (ms: number) => {
        await act(async () => {
            await jest.advanceTimersByTimeAsync(ms)
        })
    }

    it('never overlaps requests while a response hangs', async () => {
        mockGet.mockImplementation(() => new Promise(() => {})) // hangs forever
        const { onGaveUp } = renderPolling()

        await advance(10 * CLAIM_POLL_INTERVAL_MS)

        expect(mockGet).toHaveBeenCalledTimes(1)
        expect(onGaveUp).not.toHaveBeenCalled()
    })

    it('polls at the interval, then stops and reports the tx hash once on claim', async () => {
        mockGet
            .mockResolvedValueOnce({ status: 'CLAIMING', events: [] })
            .mockResolvedValue({ status: 'CLAIMED', claim: { txHash: '0xabc' }, events: [] })
        const { onClaimed, onFailed, onGaveUp, rerender } = renderPolling()

        await advance(0)
        expect(mockGet).toHaveBeenCalledTimes(1)
        expect(onClaimed).not.toHaveBeenCalled()

        await advance(CLAIM_POLL_INTERVAL_MS)
        await advance(1) // flush the batched observer notify through to the effect
        expect(mockGet).toHaveBeenCalledTimes(2)
        expect(onClaimed).toHaveBeenCalledTimes(1)
        expect(onClaimed).toHaveBeenCalledWith('0xabc')

        // terminal — no further polls, callback stays one-shot
        await advance(10 * CLAIM_POLL_SLOW_INTERVAL_MS)
        rerender()
        expect(mockGet).toHaveBeenCalledTimes(2)
        expect(onClaimed).toHaveBeenCalledTimes(1)
        expect(onFailed).not.toHaveBeenCalled()
        expect(onGaveUp).not.toHaveBeenCalled()
    })

    it('keeps polling through CLAIMED without a projected claim until the hash appears', async () => {
        // the claim write flips status before the claim intent is projected —
        // {status: CLAIMED, claim: undefined} must NOT be treated as terminal
        mockGet
            .mockResolvedValueOnce({ status: 'CLAIMED', events: [] })
            .mockResolvedValueOnce({ status: 'CLAIMED', events: [] })
            .mockResolvedValue({ status: 'CLAIMED', claim: { txHash: '0xdef' }, events: [] })
        const { onClaimed, onGaveUp } = renderPolling()

        await advance(0)
        expect(mockGet).toHaveBeenCalledTimes(1)
        expect(onClaimed).not.toHaveBeenCalled()

        await advance(2 * CLAIM_POLL_INTERVAL_MS)
        await advance(1)
        expect(mockGet).toHaveBeenCalledTimes(3)
        expect(onClaimed).toHaveBeenCalledTimes(1)
        expect(onClaimed).toHaveBeenCalledWith('0xdef')

        // now terminal — polling stopped
        await advance(10 * CLAIM_POLL_SLOW_INTERVAL_MS)
        expect(mockGet).toHaveBeenCalledTimes(3)
        expect(onGaveUp).not.toHaveBeenCalled()
    })

    it('stops and reports the failure reason once on FAILED', async () => {
        mockGet.mockResolvedValue({ status: 'FAILED', events: [{ status: 'FAILED', reason: 'out of gas' }] })
        const { onClaimed, onFailed, onGaveUp } = renderPolling()

        await advance(0)
        expect(onFailed).toHaveBeenCalledTimes(1)
        expect(onFailed).toHaveBeenCalledWith('out of gas')

        await advance(10 * CLAIM_POLL_SLOW_INTERVAL_MS)
        expect(mockGet).toHaveBeenCalledTimes(1)
        expect(onFailed).toHaveBeenCalledTimes(1)
        expect(onClaimed).not.toHaveBeenCalled()
        expect(onGaveUp).not.toHaveBeenCalled()
    })

    it('backs off to the slow interval after the fast phase', async () => {
        mockGet.mockRejectedValue(new Error('HTTP error! status: 404'))
        renderPolling()

        // fast phase: attempt 1 at t=0, then one per second
        await advance(FAST_PHASE_MS)
        expect(mockGet).toHaveBeenCalledTimes(FAST_CLAIM_POLL_ATTEMPTS)

        // a fast interval later nothing fires — the cadence has backed off
        await advance(CLAIM_POLL_SLOW_INTERVAL_MS - 1)
        expect(mockGet).toHaveBeenCalledTimes(FAST_CLAIM_POLL_ATTEMPTS)

        await advance(1)
        expect(mockGet).toHaveBeenCalledTimes(FAST_CLAIM_POLL_ATTEMPTS + 1)
    })

    it('surfaces the ceiling through onGaveUp when the link never resolves', async () => {
        mockGet.mockRejectedValue(new Error('HTTP error! status: 404'))
        const { onClaimed, onFailed, onGaveUp } = renderPolling()

        await advance(FAST_PHASE_MS + SLOW_PHASE_MS + CLAIM_POLL_SLOW_INTERVAL_MS)

        expect(mockGet).toHaveBeenCalledTimes(MAX_CLAIM_POLL_ATTEMPTS)
        expect(onGaveUp).toHaveBeenCalledTimes(1)
        expect(onClaimed).not.toHaveBeenCalled()
        expect(onFailed).not.toHaveBeenCalled()

        // stopped for good, and the give-up stays one-shot
        await advance(10 * CLAIM_POLL_SLOW_INTERVAL_MS)
        expect(mockGet).toHaveBeenCalledTimes(MAX_CLAIM_POLL_ATTEMPTS)
        expect(onGaveUp).toHaveBeenCalledTimes(1)
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
