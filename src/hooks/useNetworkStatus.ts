import { useEffect, useState } from 'react'

/**
 * NETWORK RESILIENCE: Detects online/offline status using navigator.onLine
 *
 * ⚠️ LIMITATION: navigator.onLine has false positives (WiFi connected but no internet,
 * captive portals, VPN/firewall issues). Use as UI hint only. TanStack Query's network
 * detection tests actual connectivity and is more reliable for request retries.
 *
 * 🔄 AUTO-RELOAD: When connection is restored, page automatically reloads to fetch fresh data
 *
 * @returns isOnline - Current connection status per navigator.onLine
 * @returns wasOffline - Deprecated (kept for backward compatibility, always false)
 * @returns isInitialized - True after component has mounted (prevents showing offline screen on initial load)
 */
export function useNetworkStatus() {
    const [isOnline, setIsOnline] = useState<boolean>(() =>
        typeof navigator !== 'undefined' ? navigator.onLine : true
    )
    const [wasOffline, setWasOffline] = useState<boolean>(false)
    const [isInitialized, setIsInitialized] = useState<boolean>(false)

    useEffect(() => {
        let timeoutId: ReturnType<typeof setTimeout> | null = null
        let pollIntervalId: ReturnType<typeof setInterval> | null = null

        const handleOnline = () => {
            setIsOnline(true)
            // reload immediately when connection is restored to get fresh content
            // skip the "back online" screen for faster/cleaner ux
            window.location.reload()
        }

        const handleOffline = () => {
            setIsOnline(false)
            setWasOffline(false)
            if (timeoutId) {
                clearTimeout(timeoutId)
                timeoutId = null
            }
        }

        // check current status after mount and mark as initialized
        const checkOnlineStatus = () => {
            const currentStatus = navigator.onLine
            if (currentStatus !== isOnline) {
                if (currentStatus) {
                    handleOnline()
                } else {
                    handleOffline()
                }
            }
        }

        // initial check and mark as initialized after short delay
        // this ensures we catch the actual status after mount
        setTimeout(() => {
            checkOnlineStatus()
            setIsInitialized(true)
        }, 100)

        // poll every 2 seconds to catch DevTools offline toggle
        // necessary because online/offline events don't always fire reliably in DevTools
        pollIntervalId = setInterval(checkOnlineStatus, 2000)

        // listen to standard events (works in production/real network changes)
        window.addEventListener('online', handleOnline)
        window.addEventListener('offline', handleOffline)

        // also check on visibility change (user returns to tab)
        const handleVisibilityChange = () => {
            if (!document.hidden) {
                checkOnlineStatus()
            }
        }
        document.addEventListener('visibilitychange', handleVisibilityChange)

        return () => {
            window.removeEventListener('online', handleOnline)
            window.removeEventListener('offline', handleOffline)
            document.removeEventListener('visibilitychange', handleVisibilityChange)
            if (timeoutId) {
                clearTimeout(timeoutId)
            }
            if (pollIntervalId) {
                clearInterval(pollIntervalId)
            }
        }
    }, [isOnline])

    return { isOnline, wasOffline, isInitialized }
}
