'use client'

import { useEffect } from 'react'
import { useToast } from '@/components/0_Bruddle/Toast'
import { useConnectivity } from '@/hooks/useConnectivity'
import { isDemoMode } from '@/utils/demo'

const CONNECTIVITY_TOAST_ID = 'connectivity'

/**
 * Connectivity state as a persistent toast (ruled 2026-09-03: the offline
 * notice moves off the top-of-shell Banner into the toast surface, like the
 * Rain cooldown pill). Offline = error, degraded ("trouble reaching Peanut")
 * = warning. The toast stays while the state lasts and is dismissed when the
 * connection recovers; a user can also dismiss it manually and it will not
 * nag again until the state changes.
 *
 * Renders nothing — it only drives the toast. Mounted inside ToastProvider
 * (appFlowProviders), so it covers every app shell; the /lp marketing page
 * (outside the providers) loses the offline notice, which the maintenance
 * Banner never covered there either way.
 */
export function ConnectivityToast() {
    const { show, isOffline } = useConnectivity()
    const { toast, dismiss } = useToast()

    useEffect(() => {
        // demo mode is the app-store review sandbox — no announcement applies
        if (isDemoMode()) return
        if (!show) {
            dismiss(CONNECTIVITY_TOAST_ID)
            return
        }
        // clear a stale variant first so an offline <-> degraded flip swaps
        // the message (the toast id-dedupe would otherwise keep the old one)
        dismiss(CONNECTIVITY_TOAST_ID)
        toast({
            id: CONNECTIVITY_TOAST_ID,
            duration: 'persistent',
            type: isOffline ? 'error' : 'warning',
            message: isOffline
                ? "No internet connection — some features won't work until you reconnect"
                : 'Trouble reaching Peanut — check your connection, retrying…',
        })
    }, [show, isOffline, toast, dismiss])

    return null
}
