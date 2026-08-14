'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { FAILURE_THRESHOLD, clearRecentFailures, getRecentFailures, subscribeConnectivity } from '@/utils/connectivity'

export interface ConnectivityState {
    isOffline: boolean
    isApiUnreachable: boolean
    show: boolean
}

const getServerFailures = () => 0

export function useConnectivity(): ConnectivityState {
    const [isOnline, setIsOnline] = useState(true)
    // Store owns failure expiry and emits on every change — nothing to schedule here.
    const failures = useSyncExternalStore(subscribeConnectivity, getRecentFailures, getServerFailures)

    useEffect(() => {
        setIsOnline(navigator.onLine)

        const handleOnline = () => {
            setIsOnline(true)
            // the recorded failures belong to the connection that just died —
            // without this the banner flips from "offline" to "trouble
            // reaching Peanut" for up to a window after reconnecting.
            clearRecentFailures()
        }
        const handleOffline = () => setIsOnline(false)
        window.addEventListener('online', handleOnline)
        window.addEventListener('offline', handleOffline)

        return () => {
            window.removeEventListener('online', handleOnline)
            window.removeEventListener('offline', handleOffline)
        }
    }, [])

    const isOffline = !isOnline
    const isApiUnreachable = isOnline && failures >= FAILURE_THRESHOLD

    return { isOffline, isApiUnreachable, show: isOffline || isApiUnreachable }
}
