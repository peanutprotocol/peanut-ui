'use client'

import { notificationsApi } from '@/services/notifications'
import { useCallback, useEffect, useState } from 'react'

/**
 * True when support has replied since the user last opened the chat.
 *
 * The count is server-side truth. Neither client can work it out alone: the web
 * Crisp widget lives in a sandboxed iframe that mounts only after the drawer is
 * first opened, and the native plugin exposes no message events. The backend
 * writes one in-app notification row per support reply, and this reads the
 * count for the `support` category.
 *
 * No polling. It refetches on mount, when the notifications list changes, and
 * when the tab or app comes back to the foreground.
 */
export const useSupportUnread = (): boolean => {
    const [hasUnread, setHasUnread] = useState(false)

    const refresh = useCallback(() => {
        notificationsApi
            .unreadCount('support')
            .then(({ count }) => setHasUnread(count > 0))
            // A failed count must never break the nav bar.
            .catch(() => {})
    }, [])

    useEffect(() => {
        refresh()

        const onVisibilityChange = () => {
            if (document.visibilityState === 'visible') refresh()
        }

        window.addEventListener('notifications:updated', refresh)
        document.addEventListener('visibilitychange', onVisibilityChange)
        return () => {
            window.removeEventListener('notifications:updated', refresh)
            document.removeEventListener('visibilitychange', onVisibilityChange)
        }
    }, [refresh])

    return hasUnread
}
