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
 * foreground, connectivity returns, or a foreground push arrived (dispatched
 * wherever OneSignal is wired: useNativeAppLinks on native, useNotifications
 * on web). A trigger during backoff waits until its deadline; a failed request
 * does not start an automatic retry loop.
 */
export const useSupportUnread = (enabled = true, userId?: string): boolean => {
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
    const activeRequest = useRef<AbortController | null>(null)
    const retryAfter = useRef(0)
    const failures = useRef(0)
    const coalesceTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
    const invalidateActiveRequest = useCallback(() => {
        ++latestRequestId.current
        activeRequest.current?.abort()
    }, [])

    const refresh = useCallback(
        function refreshCount() {
            coalesceTimer.current = undefined
            if (!enabled || document.hidden || !navigator.onLine) return
            const remainingBackoff = retryAfter.current - Date.now()
            if (remainingBackoff > 0) {
                // Keep one pending event-driven refresh rather than discarding the
                // last push until another event happens to arrive. scheduleRefresh
                // and lifecycle cleanup share this single timer.
                coalesceTimer.current = setTimeout(refreshCount, remainingBackoff)
                return
            }
            activeRequest.current?.abort()
            const controller = new AbortController()
            activeRequest.current = controller
            const requestId = ++latestRequestId.current
            notificationsApi
                .unreadCount('support', controller.signal)
                .then(({ count }) => {
                    if (requestId !== latestRequestId.current || controller.signal.aborted) return
                    failures.current = 0
                    retryAfter.current = 0
                    setHasUnread(count > 0)
                })
                // A failed count must never break the nav bar.
                .catch(() => {
                    if (requestId !== latestRequestId.current || controller.signal.aborted) return
                    retryAfter.current = Date.now() + Math.min(5_000 * 2 ** failures.current++, 60_000)
                })
        },
        [enabled]
    )

    const scheduleRefresh = useCallback(() => {
        // Invalidate any in-flight response NOW. Before the coalescer this
        // happened inside refresh() on the same tick as the trigger; without
        // it, a count fetched before the trigger can resolve inside the
        // coalesce window and win back state the trigger just made stale.
        invalidateActiveRequest()
        clearTimeout(coalesceTimer.current)
        coalesceTimer.current = setTimeout(refresh, REFRESH_COALESCE_MS)
    }, [refresh, invalidateActiveRequest])

    useEffect(() => {
        retryAfter.current = 0
        failures.current = 0
        setHasUnread(false)
        if (!enabled) {
            setHasUnread(false)
            return
        }
        refresh()

        const pauseRefresh = () => {
            invalidateActiveRequest()
            clearTimeout(coalesceTimer.current)
        }
        const onVisibilityChange = () => {
            if (document.visibilityState === 'visible') scheduleRefresh()
            else pauseRefresh()
        }

        window.addEventListener(NOTIFICATIONS_UPDATED_EVENT, scheduleRefresh)
        window.addEventListener('online', scheduleRefresh)
        window.addEventListener('offline', pauseRefresh)
        document.addEventListener('visibilitychange', onVisibilityChange)
        return () => {
            invalidateActiveRequest()
            clearTimeout(coalesceTimer.current)
            window.removeEventListener(NOTIFICATIONS_UPDATED_EVENT, scheduleRefresh)
            window.removeEventListener('online', scheduleRefresh)
            window.removeEventListener('offline', pauseRefresh)
            document.removeEventListener('visibilitychange', onVisibilityChange)
        }
    }, [enabled, userId, refresh, scheduleRefresh, invalidateActiveRequest])

    return hasUnread
}
