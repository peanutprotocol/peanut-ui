'use client'

import { useEffect, useState } from 'react'
import { getConsecutiveFailures, subscribeConnectivity } from '@/utils/connectivity'

// Only treat the API as unreachable after this many back-to-back failures, so a
// single blip doesn't flash a banner. Any successful response resets the count.
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
        setFailures(getConsecutiveFailures())

        const handleOnline = () => setIsOnline(true)
        const handleOffline = () => setIsOnline(false)
        window.addEventListener('online', handleOnline)
        window.addEventListener('offline', handleOffline)

        const unsubscribe = subscribeConnectivity(() => setFailures(getConsecutiveFailures()))

        return () => {
            window.removeEventListener('online', handleOnline)
            window.removeEventListener('offline', handleOffline)
            unsubscribe()
        }
    }, [])

    const isOffline = !isOnline
    const isApiUnreachable = isOnline && failures >= FAILURE_THRESHOLD

    return { isOffline, isApiUnreachable, show: isOffline || isApiUnreachable }
}
