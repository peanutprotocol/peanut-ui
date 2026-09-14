'use client'

import { getOneSignalAdapter } from '@/services/onesignal'
import { isCapacitor } from '@/utils/capacitor'
import { onForegroundPushDelivered } from '@/utils/notifications-events'
import { useEffect } from 'react'

/**
 * Web half of the foreground-push badge refresh, for sessions that never
 * mount useNotifications: a direct authenticated load of /card or /history
 * renders the BottomNav badge, but the home/waitlist surfaces that own the
 * OneSignal init never mount, so a foreground push could not dispatch the
 * refresh event. Mounted from BottomNav — the app shell — so marketing
 * routes never load the OneSignal chunk.
 *
 * Registration is deliberately page-lifetime (no unregister): the adapter's
 * listener Set dedupes the shared onForegroundPushDelivered reference, and an
 * unmount cleanup here would also remove the registration useNotifications
 * made with that same reference.
 *
 * Native is covered globally by useNativeAppLinks, which registers the same
 * bridge and drives init on every cold-start destination.
 */
export function useForegroundPushRefresh() {
    useEffect(() => {
        if (isCapacitor()) return
        getOneSignalAdapter()
            .then((adapter) => {
                adapter.onNotificationReceived(onForegroundPushDelivered)
                return adapter.init()
            })
            // without init no foreground event can fire; the badge then falls
            // back to visibility-edge refreshes, so warn rather than break
            .catch((e) => console.warn('onesignal init for foreground push refresh failed:', e))
    }, [])
}
