import { serverFetch } from '@/utils/api-fetch'

// the in-app notifications PAGE is gone; what stays is the unread badge and
// mark-read plumbing the support drawer and bottom nav rely on
export const notificationsApi = {
    /** Pass a category (e.g. 'support') to count only that category's unread rows. */
    async unreadCount(category?: string): Promise<{ count: number }> {
        const query = category ? `?category=${encodeURIComponent(category)}` : ''
        const response = await serverFetch(`/notifications/unread-count${query}`, {
            method: 'GET',
        })
        if (!response.ok) throw new Error('failed to fetch unread count')
        return await response.json()
    },

    async markRead(ids: string[]) {
        const response = await serverFetch('/notifications/mark-read', {
            method: 'POST',
            body: JSON.stringify({ ids }),
        })
        if (!response.ok) throw new Error('failed to mark read')
        return await response.json()
    },

    /**
     * Mark every unread row in a category as read. Used by the support drawer,
     * which never sees the row ids — the conversation itself lives in Crisp.
     */
    async markAllRead(category: string) {
        const response = await serverFetch('/notifications/mark-read', {
            method: 'POST',
            body: JSON.stringify({ category }),
        })
        if (!response.ok) throw new Error('failed to mark read')
        return await response.json()
    },
}
