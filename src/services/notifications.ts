import { serverFetch } from '@/utils/api-fetch'
import type { NotificationPermissionState } from '@/services/onesignal/types'

/** The OS answer last reported to the API. */
export type PushPermission = 'granted' | 'denied' | 'dismissed'

// the in-app notifications PAGE is gone; what stays is the unread badge and
// mark-read plumbing the support drawer and bottom nav rely on
export type NotificationPreferences = {
    /** Important alerts: payments, account and security pushes. */
    push: boolean
    /** The whole email channel; the app no longer changes it. */
    email: boolean
    /** Offers and perks: marketing pushes, the user's own opt-in. */
    marketingPush: boolean
    /** Email updates: setup tips and news by email. Account emails always go out. */
    emailUpdates: boolean
    pushPermission: PushPermission | null
}

export type PreferenceChanges = Partial<Omit<NotificationPreferences, 'email' | 'pushPermission'>> & {
    pushPermission?: PushPermission
}

/** A prompt closed without an answer, or one that never opened, leaves the OS at `default`. */
export const toPushPermission = (state: NotificationPermissionState): PushPermission =>
    state === 'default' ? 'dismissed' : state

export const notificationsApi = {
    async getPreferences(): Promise<NotificationPreferences> {
        const response = await serverFetch('/notifications/preferences', { method: 'GET' })
        if (!response.ok) throw new Error('Could not load notification preferences')
        return await response.json()
    },
    /** Saves only the choices passed and answers with all of them. */
    async savePreferences(changes: PreferenceChanges): Promise<NotificationPreferences> {
        let response = await serverFetch('/notifications/preferences', {
            method: 'PUT',
            body: JSON.stringify(changes),
        })
        if (
            response.status === 400 &&
            typeof changes.push === 'boolean' &&
            Object.keys(changes).some((key) => key !== 'push')
        ) {
            response = await serverFetch('/notifications/preferences', {
                method: 'PUT',
                body: JSON.stringify({ push: changes.push }),
            })
        }
        if (!response.ok) throw new Error('Could not save notification preferences')
        return await response.json()
    },
    /** Pass a category (e.g. 'support') to count only that category's unread rows. */
    async unreadCount(category?: string, signal?: AbortSignal): Promise<{ count: number }> {
        const query = category ? `?category=${encodeURIComponent(category)}` : ''
        const response = await serverFetch(`/notifications/unread-count${query}`, {
            method: 'GET',
            signal,
            // The optional badge keeps its cached value when this GET times out.
            // API timing events and a Sentry breadcrumb retain the diagnostic.
            silentTimeout: true,
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
