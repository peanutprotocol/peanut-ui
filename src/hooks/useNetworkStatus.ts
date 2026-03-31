import { useEffect, useRef, useState } from 'react'

/**
 * NETWORK RESILIENCE: Detects online/offline status with fetch verification.
 *
 * navigator.onLine is unreliable on some desktop browsers (Brave especially) — it
 * reports false negatives (says offline when user is online) due to shields, VPN,
 * multiple network adapters, etc. Mobile browsers are more reliable since they
 * directly control the network radio.
 *
 * Strategy:
 *   navigator.onLine === true  → trust it (user is online)
 *   navigator.onLine === false → verify with HEAD fetch to /favicon.ico
 *     → fetch succeeds → user is online (navigator lied)
 *     → fetch fails    → user is truly offline → show offline screen
 *
 * @returns isOnline - Current verified connection status
 * @returns isInitialized - True after initial connectivity check completes
 */

const VERIFICATION_TIMEOUT_MS = 3000

/**
 * verify actual connectivity by fetching a static asset.
 * uses HEAD /favicon.ico with cache-busting to bypass browser http cache.
 * the service worker may still serve from its cache — that's intentional:
 * if the SW can serve assets, the app is functional.
 */
export async function verifyConnectivity(): Promise<boolean> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), VERIFICATION_TIMEOUT_MS)

    try {
        const response = await fetch(`/favicon.ico?_cb=${Date.now()}`, {
            method: 'HEAD',
            cache: 'no-store',
            signal: controller.signal,
        })
        return response.ok
    } catch {
        return false
    } finally {
        clearTimeout(timeoutId)
    }
}

export function useNetworkStatus() {
    const [isOnline, setIsOnline] = useState<boolean>(true)
    const [isInitialized, setIsInitialized] = useState<boolean>(false)

    // ref to track latest online state inside event handlers without stale closures
    const isOnlineRef = useRef<boolean>(true)

    // generation counter to invalidate stale offline verifications
    const verificationGenRef = useRef<number>(0)

    // prevent reload loops from rapid navigator.onLine flickers
    const reloadScheduledRef = useRef<boolean>(false)

    useEffect(() => {
        let mounted = true
        let initTimeoutId: ReturnType<typeof setTimeout> | null = null
        // shared promise so concurrent callers (e.g. offline event + init timeout)
        // await the same verification instead of one silently skipping
        let activeVerification: Promise<void> | null = null

        const updateOnlineStatus = (online: boolean) => {
            if (!mounted) return
            isOnlineRef.current = online
            setIsOnline(online)
        }

        // when navigator.onLine reports offline, verify with a real fetch
        // before showing the offline screen. catches brave/desktop false negatives.
        const handlePossiblyOffline = async () => {
            // if a verification is already in-flight, await it instead of skipping
            if (activeVerification) {
                await activeVerification
                return
            }

            const generation = ++verificationGenRef.current

            activeVerification = (async () => {
                try {
                    const reallyOnline = await verifyConnectivity()
                    // ignore stale result if handleOnline() fired while we were verifying
                    if (!mounted || generation !== verificationGenRef.current) return
                    updateOnlineStatus(reallyOnline)
                } finally {
                    if (generation === verificationGenRef.current) {
                        activeVerification = null
                    }
                }
            })()

            await activeVerification
        }

        const handleOnline = () => {
            // invalidate any in-flight offline verification
            verificationGenRef.current++
            activeVerification = null
            const wasShowingOffline = !isOnlineRef.current
            updateOnlineStatus(true)

            // reload to get fresh content, but only if we were showing the offline
            // screen. short delay avoids reload loops from rapid flickers.
            if (wasShowingOffline && !reloadScheduledRef.current) {
                reloadScheduledRef.current = true
                setTimeout(() => {
                    if (mounted && isOnlineRef.current) {
                        window.location.reload()
                    }
                    reloadScheduledRef.current = false
                }, 1000)
            }
        }

        const handleOffline = () => {
            void handlePossiblyOffline()
        }

        const handleVisibilityChange = () => {
            if (!document.hidden) {
                if (!navigator.onLine) {
                    void handlePossiblyOffline()
                } else if (!isOnlineRef.current) {
                    // was showing offline but navigator now says online
                    handleOnline()
                }
            }
        }

        // initial check after hydration settles
        initTimeoutId = setTimeout(async () => {
            if (!mounted) return

            if (navigator.onLine) {
                updateOnlineStatus(true)
            } else {
                await handlePossiblyOffline()
            }

            if (mounted) {
                setIsInitialized(true)
            }
        }, 100)

        window.addEventListener('online', handleOnline)
        window.addEventListener('offline', handleOffline)
        document.addEventListener('visibilitychange', handleVisibilityChange)

        return () => {
            mounted = false
            window.removeEventListener('online', handleOnline)
            window.removeEventListener('offline', handleOffline)
            document.removeEventListener('visibilitychange', handleVisibilityChange)
            if (initTimeoutId) clearTimeout(initTimeoutId)
        }
    }, [])

    return { isOnline, isInitialized }
}
