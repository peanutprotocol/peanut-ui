import { serverFetch } from '@/utils/api-fetch'

export type InAppItem = {
    id: string
    category: string
    title: string
    body?: string | null
    iconUrl?: string | null
    imageUrl?: string | null
    ctaLabel?: string | null
    ctaDeeplink?: string | null
    metadata?: Record<string, unknown> | null
    createdAt: string
    state: { readAt: string | null; dismissedAt: string | null; pinned: boolean }
}

export type ListResponse = { items: InAppItem[]; nextCursor: string | null }

export const notificationsApi = {
    async list(params: { limit?: number; cursor?: string | null; filter?: 'all' | 'unread'; category?: string } = {}) {
        const { limit = 20, cursor, filter = 'all', category } = params
        const search = new URLSearchParams()
        search.set('limit', String(limit))
        search.set('filter', filter)
        if (cursor) search.set('cursor', cursor)
        if (category) search.set('category', category)

        try {
            const response = await serverFetch(`/notifications?${search.toString()}`, {
                method: 'GET',
            })
            if (!response.ok) throw new Error('failed to fetch notifications')
            return (await response.json()) as ListResponse
        } catch (e) {
            throw e
        }
    },

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
