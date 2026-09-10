import { renderHook, act, waitFor } from '@testing-library/react'
import { useSupportUnread } from '@/hooks/useSupportUnread'

const mockUnreadCount = jest.fn()
jest.mock('@/services/notifications', () => ({
    notificationsApi: {
        unreadCount: (category?: string) => mockUnreadCount(category),
    },
}))

beforeEach(() => {
    mockUnreadCount.mockReset()
    mockUnreadCount.mockResolvedValue({ count: 0 })
})

describe('useSupportUnread', () => {
    it('asks only for the support category', async () => {
        renderHook(() => useSupportUnread())
        await waitFor(() => expect(mockUnreadCount).toHaveBeenCalledWith('support'))
    })

    it('is false while nothing is unread', async () => {
        const { result } = renderHook(() => useSupportUnread())
        await waitFor(() => expect(mockUnreadCount).toHaveBeenCalled())
        expect(result.current).toBe(false)
    })

    it('is true once support has replied', async () => {
        mockUnreadCount.mockResolvedValue({ count: 2 })
        const { result } = renderHook(() => useSupportUnread())
        await waitFor(() => expect(result.current).toBe(true))
    })

    it('refetches when the notifications list changes', async () => {
        const { result } = renderHook(() => useSupportUnread())
        await waitFor(() => expect(result.current).toBe(false))

        // The drawer marks the category read, then fires this event.
        mockUnreadCount.mockResolvedValue({ count: 1 })
        act(() => {
            window.dispatchEvent(new CustomEvent('notifications:updated'))
        })
        await waitFor(() => expect(result.current).toBe(true))
    })

    it('refetches when the app comes back to the foreground', async () => {
        const { result } = renderHook(() => useSupportUnread())
        await waitFor(() => expect(result.current).toBe(false))

        mockUnreadCount.mockResolvedValue({ count: 1 })
        act(() => {
            document.dispatchEvent(new Event('visibilitychange'))
        })
        await waitFor(() => expect(result.current).toBe(true))
    })

    it('stays false when the count request fails', async () => {
        mockUnreadCount.mockRejectedValue(new Error('offline'))
        const { result } = renderHook(() => useSupportUnread())
        await waitFor(() => expect(mockUnreadCount).toHaveBeenCalled())
        expect(result.current).toBe(false)
    })

    it('coalesces a burst of triggers into one request', async () => {
        renderHook(() => useSupportUnread())
        await waitFor(() => expect(mockUnreadCount).toHaveBeenCalledTimes(1))

        jest.useFakeTimers()
        try {
            // an iOS resume fires both the lifecycle event and visibilitychange
            window.dispatchEvent(new CustomEvent('notifications:updated'))
            document.dispatchEvent(new Event('visibilitychange'))
            jest.advanceTimersByTime(1_000)
            expect(mockUnreadCount).toHaveBeenCalledTimes(2)
        } finally {
            jest.useRealTimers()
        }
    })

    it('drops a stale in-flight response that resolves inside the coalesce window', async () => {
        let resolveMountFetch: (value: { count: number }) => void
        mockUnreadCount.mockImplementationOnce(
            () =>
                new Promise((resolve) => {
                    resolveMountFetch = resolve
                })
        )
        const { result } = renderHook(() => useSupportUnread())
        await waitFor(() => expect(mockUnreadCount).toHaveBeenCalledTimes(1))

        jest.useFakeTimers()
        try {
            // the drawer marks everything read and fires the event...
            mockUnreadCount.mockResolvedValue({ count: 0 })
            act(() => {
                window.dispatchEvent(new CustomEvent('notifications:updated'))
            })
            // ...then the pre-event response lands inside the coalesce window.
            // It is stale and must not light the badge.
            await act(async () => {
                resolveMountFetch!({ count: 1 })
            })
            expect(result.current).toBe(false)

            // the coalesced request settles the truth
            await act(async () => {
                jest.advanceTimersByTime(1_000)
            })
            expect(result.current).toBe(false)
        } finally {
            jest.useRealTimers()
        }
    })

    it('stops listening after unmount', async () => {
        const { unmount } = renderHook(() => useSupportUnread())
        await waitFor(() => expect(mockUnreadCount).toHaveBeenCalledTimes(1))

        unmount()
        jest.useFakeTimers()
        try {
            window.dispatchEvent(new CustomEvent('notifications:updated'))
            // past the coalesce window — a leaked listener would fetch here
            jest.advanceTimersByTime(1_000)
            expect(mockUnreadCount).toHaveBeenCalledTimes(1)
        } finally {
            jest.useRealTimers()
        }
    })
})
