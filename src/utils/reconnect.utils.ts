const RECONNECT_FALLBACK_MS = 60_000

/**
 * Calls `onReady` once when the device looks able to reach the network again:
 * the `online` event, the tab returning to the foreground, or a fallback timer
 * for outages that end without either signal. Returns an unsubscribe.
 */
export const onReconnect = (onReady: () => void, fallbackMs: number = RECONNECT_FALLBACK_MS): (() => void) => {
    if (typeof window === 'undefined') return () => {}

    let done = false
    const fire = () => {
        if (done) return
        done = true
        cleanup()
        onReady()
    }
    const onVisible = () => {
        if (document.visibilityState === 'visible') fire()
    }
    const timer = setTimeout(fire, fallbackMs)
    const cleanup = () => {
        clearTimeout(timer)
        window.removeEventListener('online', fire)
        document.removeEventListener('visibilitychange', onVisible)
    }

    window.addEventListener('online', fire)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
        done = true
        cleanup()
    }
}
