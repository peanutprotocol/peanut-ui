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

    it('stops listening after unmount', async () => {
        const { unmount } = renderHook(() => useSupportUnread())
        await waitFor(() => expect(mockUnreadCount).toHaveBeenCalledTimes(1))

        unmount()
        window.dispatchEvent(new CustomEvent('notifications:updated'))
        expect(mockUnreadCount).toHaveBeenCalledTimes(1)
    })
})
