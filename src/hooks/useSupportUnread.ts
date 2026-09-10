'use client'

import { notificationsApi } from '@/services/notifications'
import { NOTIFICATIONS_UPDATED_EVENT } from '@/utils/notifications-events'
import { useCallback, useEffect, useRef, useState } from 'react'

/*
 * One trigger can arrive several times within a moment: an iOS resume fires
 * both `visibilitychange` and the native lifecycle event, and a burst of
 * foreground pushes fires one event each. Coalesce event-driven refetches on
 * the trailing edge so each burst costs one request. The mount fetch stays
 * immediate so the badge is right on first paint.
 */
const REFRESH_COALESCE_MS = 250

/**
 * True when support has replied since the user last opened the chat.
 *
 * The count is server-side truth. Neither client can work it out alone: the web
 * Crisp widget lives in a sandboxed iframe that mounts only after the drawer is
 * first opened, and the native plugin exposes no message events. The backend
 * writes one in-app notification row per support reply, and this reads the
 * count for the `support` category.
 *
 * No polling. It refetches on mount; after that, refetches are event-driven —
 * the notifications list changed, the tab or native app came back to the
 * foreground, or a foreground push arrived (dispatched wherever OneSignal is
 * wired: useNativeAppLinks on native, useNotifications on web).
 */
export const useSupportUnread = (): boolean => {
    const [hasUnread, setHasUnread] = useState(false)
    /*
     * Responses can land out of order, and the stale one would win. Tapping a
     * push on a backgrounded app fires a foreground refetch (count 1), then the
     * deep link opens the drawer, which clears the badge and fires a second
     * refetch (count 0). If the first response arrives last — routine on a
     * mobile radio — the badge sticks on with nothing behind it, and with no
     * polling nothing corrects it until the next foreground.
     */
    const latestRequestId = useRef(0)

    const refresh = useCallback(() => {
        const requestId = ++latestRequestId.current
        notificationsApi
            .unreadCount('support')
            .then(({ count }) => {
                if (requestId === latestRequestId.current) setHasUnread(count > 0)
            })
            // A failed count must never break the nav bar.
            .catch(() => {})
    }, [])

    const coalesceTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
    const scheduleRefresh = useCallback(() => {
        clearTimeout(coalesceTimer.current)
        coalesceTimer.current = setTimeout(refresh, REFRESH_COALESCE_MS)
    }, [refresh])

    useEffect(() => {
        refresh()

        const onVisibilityChange = () => {
            if (document.visibilityState === 'visible') scheduleRefresh()
        }

        window.addEventListener(NOTIFICATIONS_UPDATED_EVENT, scheduleRefresh)
        document.addEventListener('visibilitychange', onVisibilityChange)
        return () => {
            clearTimeout(coalesceTimer.current)
            window.removeEventListener(NOTIFICATIONS_UPDATED_EVENT, scheduleRefresh)
            document.removeEventListener('visibilitychange', onVisibilityChange)
        }
    }, [refresh, scheduleRefresh])

    return hasUnread
}
