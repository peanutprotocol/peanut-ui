'use client'

import { useEffect, useState } from 'react'
import { getMsUntilNextExpiry, getRecentFailures, subscribeConnectivity } from '@/utils/connectivity'

// Only treat the API as unreachable after this many failures inside the
// sliding window (FAILURE_WINDOW_MS), so a single blip doesn't flash a banner.
// Successes don't reset the count — on a flaky connection parallel requests
// interleave successes with failures, and a success-reset kept the banner from
// ever firing. Entries age out of the window on their own.
const FAILURE_THRESHOLD = 2

export interface ConnectivityState {
    isOffline: boolean
    isApiUnreachable: boolean
    show: boolean
}

export function useConnectivity(): ConnectivityState {
    const [isOnline, setIsOnline] = useState(true)
    const [failures, setFailures] = useState(0)

    useEffect(() => {
        setIsOnline(navigator.onLine)
        setFailures(getRecentFailures())

        const handleOnline = () => setIsOnline(true)
        const handleOffline = () => setIsOnline(false)
        window.addEventListener('online', handleOnline)
        window.addEventListener('offline', handleOffline)

        const unsubscribe = subscribeConnectivity(() => setFailures(getRecentFailures()))

        return () => {
            window.removeEventListener('online', handleOnline)
            window.removeEventListener('offline', handleOffline)
            unsubscribe()
        }
    }, [])

    // Failures only ever age out — nothing emits when that happens, so re-read
    // the count when the oldest one expires or the banner would stick forever.
    useEffect(() => {
        if (failures === 0) return
        const ms = getMsUntilNextExpiry()
        if (ms === null) return
        const id = setTimeout(() => setFailures(getRecentFailures()), ms + 50)
        return () => clearTimeout(id)
    }, [failures])

    const isOffline = !isOnline
    const isApiUnreachable = isOnline && failures >= FAILURE_THRESHOLD

    return { isOffline, isApiUnreachable, show: isOffline || isApiUnreachable }
}
