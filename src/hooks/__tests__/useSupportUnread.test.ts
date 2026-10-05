import { renderHook, act, waitFor } from '@testing-library/react'
import { useSupportUnread } from '@/hooks/useSupportUnread'

const mockUnreadCount = jest.fn()
jest.mock('@/services/notifications', () => ({
    notificationsApi: {
        unreadCount: (category?: string, signal?: AbortSignal) => mockUnreadCount(category, signal),
    },
}))

beforeEach(() => {
    mockUnreadCount.mockReset()
    mockUnreadCount.mockResolvedValue({ count: 0 })
})

describe('useSupportUnread', () => {
    it('does not request an optional badge while logged out or hidden', async () => {
        const { rerender } = renderHook(({ enabled }) => useSupportUnread(enabled), {
            initialProps: { enabled: false },
        })
        expect(mockUnreadCount).not.toHaveBeenCalled()
        const hidden = jest.spyOn(document, 'hidden', 'get').mockReturnValue(true)
        rerender({ enabled: true })
        expect(mockUnreadCount).not.toHaveBeenCalled()
        hidden.mockRestore()
    })

    it('cancels an in-flight badge request on backgrounding and ignores its late result', async () => {
        let finish!: (result: { count: number }) => void
        mockUnreadCount.mockImplementationOnce(
            () =>
                new Promise((resolve) => {
                    finish = resolve
                })
        )
        const { result } = renderHook(() => useSupportUnread())
        await waitFor(() => expect(mockUnreadCount).toHaveBeenCalledTimes(1))
        const signal = mockUnreadCount.mock.calls[0][1] as AbortSignal
        const visibility = jest.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
        act(() => document.dispatchEvent(new Event('visibilitychange')))
        expect(signal.aborted).toBe(true)
        await act(async () => finish({ count: 1 }))
        expect(result.current).toBe(false)
        visibility.mockRestore()
    })

    it('backs off repeated failure triggers and keeps the last successful badge value', async () => {
        mockUnreadCount.mockResolvedValueOnce({ count: 1 })
        const { result } = renderHook(() => useSupportUnread())
        await waitFor(() => expect(result.current).toBe(true))
        jest.useFakeTimers()
        try {
            mockUnreadCount.mockRejectedValue(new Error('timeout'))
            await act(async () => {
                window.dispatchEvent(new CustomEvent('notifications:updated'))
                jest.advanceTimersByTime(250)
            })
            expect(mockUnreadCount).toHaveBeenCalledTimes(2)
            await act(async () => {
                window.dispatchEvent(new CustomEvent('notifications:updated'))
                jest.advanceTimersByTime(250)
            })
            expect(mockUnreadCount).toHaveBeenCalledTimes(2)
            expect(result.current).toBe(true)
            mockUnreadCount.mockResolvedValue({ count: 0 })
            await act(async () => {
                jest.advanceTimersByTime(5_000)
                window.dispatchEvent(new CustomEvent('notifications:updated'))
                jest.advanceTimersByTime(250)
            })
            expect(result.current).toBe(false)
        } finally {
            jest.useRealTimers()
        }
    })
    it('asks only for the support category', async () => {
        renderHook(() => useSupportUnread())
        await waitFor(() => expect(mockUnreadCount).toHaveBeenCalledWith('support', expect.any(AbortSignal)))
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
