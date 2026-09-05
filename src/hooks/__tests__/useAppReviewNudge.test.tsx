import { act, renderHook } from '@testing-library/react'
import { useAppReviewNudge } from '@/hooks/useAppReviewNudge'

const requestAppReviewMock = jest.fn()
jest.mock('@/utils/app-review', () => ({
    requestAppReview: (...args: unknown[]) => requestAppReviewMock(...args),
}))

const SETTLE_MS = 2_500

describe('useAppReviewNudge', () => {
    beforeEach(() => {
        jest.useFakeTimers()
        requestAppReviewMock.mockReset()
        requestAppReviewMock.mockResolvedValue(undefined)
    })

    afterEach(() => {
        jest.useRealTimers()
    })

    const settle = (ms = SETTLE_MS) =>
        act(() => {
            jest.advanceTimersByTime(ms)
        })

    it('asks once the success screen has settled, with the user and trigger', () => {
        renderHook(() => useAppReviewNudge('user-aaa', 'payment_completed', true))

        settle(SETTLE_MS - 1)
        expect(requestAppReviewMock).not.toHaveBeenCalled()

        settle(1)
        expect(requestAppReviewMock).toHaveBeenCalledTimes(1)
        expect(requestAppReviewMock).toHaveBeenCalledWith('user-aaa', 'payment_completed')
    })

    it('never asks a user who left the success screen before it settled', () => {
        const { unmount } = renderHook(() => useAppReviewNudge('user-aaa', 'reward_claimed', true))

        settle(SETTLE_MS - 100)
        unmount()
        settle(SETTLE_MS)

        expect(requestAppReviewMock).not.toHaveBeenCalled()
    })

    it('cancels the ask when the success is no longer confirmed', () => {
        const { rerender } = renderHook(({ enabled }) => useAppReviewNudge('user-aaa', 'money_received', enabled), {
            initialProps: { enabled: true },
        })

        settle(SETTLE_MS - 100)
        rerender({ enabled: false })
        settle(SETTLE_MS)

        expect(requestAppReviewMock).not.toHaveBeenCalled()
    })

    it('banks one moment per mount however often the surface re-renders', () => {
        // HomeCarouselCTA's `enabled` flips as the perk modal opens and closes
        const { rerender } = renderHook(({ enabled }) => useAppReviewNudge('user-aaa', 'reward_claimed', enabled), {
            initialProps: { enabled: true },
        })

        settle()
        expect(requestAppReviewMock).toHaveBeenCalledTimes(1)

        rerender({ enabled: false })
        settle()
        rerender({ enabled: true })
        settle()

        expect(requestAppReviewMock).toHaveBeenCalledTimes(1)
    })

    it('does not ask before the success is confirmed', () => {
        renderHook(() => useAppReviewNudge('user-aaa', 'qr_payment_completed', false))

        settle()

        expect(requestAppReviewMock).not.toHaveBeenCalled()
    })

    it('does not ask when there is no user to bank the moment against', () => {
        renderHook(() => useAppReviewNudge(undefined, 'payment_completed', true))

        settle()

        expect(requestAppReviewMock).not.toHaveBeenCalled()
    })
})
