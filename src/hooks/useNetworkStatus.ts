import { useEffect, useState } from 'react'

/**
 * NETWORK RESILIENCE: Detects online/offline status using navigator.onLine
 *
 * ⚠️ LIMITATION: navigator.onLine has false positives (WiFi connected but no internet,
 * captive portals, VPN/firewall issues). Use as UI hint only. TanStack Query's network
 * detection tests actual connectivity and is more reliable for request retries.
 *
 * @returns isOnline - Current connection status per navigator.onLine
 * @returns wasOffline - True for 3s after coming back online (useful for "restored" toast)
 */
export function useNetworkStatus() {
    const [isOnline, setIsOnline] = useState<boolean>(() =>
        typeof navigator !== 'undefined' ? navigator.onLine : true
    )
    const [wasOffline, setWasOffline] = useState<boolean>(false)

    useEffect(() => {
        let timeoutId: ReturnType<typeof setTimeout> | null = null

        const handleOnline = () => {
            setIsOnline(true)
            setWasOffline(true)
            timeoutId = setTimeout(() => setWasOffline(false), 3000)
        }

        const handleOffline = () => {
            setIsOnline(false)
            setWasOffline(false)
            if (timeoutId) {
                clearTimeout(timeoutId)
                timeoutId = null
            }
        }

        window.addEventListener('online', handleOnline)
        window.addEventListener('offline', handleOffline)

        return () => {
            window.removeEventListener('online', handleOnline)
            window.removeEventListener('offline', handleOffline)
            if (timeoutId) {
                clearTimeout(timeoutId)
            }
        }
    }, [])

    return { isOnline, wasOffline }
}
