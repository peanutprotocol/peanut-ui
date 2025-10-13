import { PEANUT_API_URL } from '@/constants'
import Cookies from 'js-cookie'

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

        const token = Cookies.get('jwt-token')
        const url = `${PEANUT_API_URL}/notifications?${search.toString()}`

        try {
            const response = await fetch(url, {
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
            })
            if (!response.ok) throw new Error('failed to fetch notifications')
            return (await response.json()) as ListResponse
        } catch (e) {
            throw e
        }
    },

    async unreadCount(): Promise<{ count: number }> {
        const response = await fetch(`${PEANUT_API_URL}/notifications/unread-count`, {
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${Cookies.get('jwt-token')}`,
            },
        })
        if (!response.ok) throw new Error('failed to fetch unread count')
        return await response.json()
    },

    async markRead(ids: string[]) {
        const response = await fetch(`${PEANUT_API_URL}/notifications/mark-read`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${Cookies.get('jwt-token')}`,
            },
            body: JSON.stringify({ ids }),
        })
        if (!response.ok) throw new Error('failed to mark read')
        return await response.json()
    },
}
