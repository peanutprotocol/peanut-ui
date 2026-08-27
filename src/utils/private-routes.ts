/**
 * Routes whose contents must never reach analytics, error reporting or a cache.
 *
 * Lives in utils, not in the feature folder: app-wide infrastructure
 * (instrumentation-client, sentry-init, the service worker, the CSP report
 * filter) consults this, and infrastructure must not import from a /dev feature.
 */
export const PAYMENT_NETWORK_PATH = '/dev/payment-graph'

export function isPaymentNetworkExplorerPath(pathname: string): boolean {
    return pathname === PAYMENT_NETWORK_PATH || pathname.startsWith(`${PAYMENT_NETWORK_PATH}/`)
}

type GuardedWindow = Window &
    Record<string, unknown> & {
        __paymentNetworkGaGuardInstalled?: boolean
    }

export function disablePaymentNetworkGoogleAnalytics(
    pathname = typeof window === 'undefined' ? '' : window.location.pathname,
    measurementId = process.env.NEXT_PUBLIC_GA_KEY
): void {
    if (typeof window === 'undefined' || !measurementId || !isPaymentNetworkExplorerPath(pathname)) return
    ;(window as unknown as GuardedWindow)[`ga-disable-${measurementId}`] = true
}

/** Disable GA synchronously before a client-side history transition commits. */
export function installPaymentNetworkGoogleAnalyticsGuard(): void {
    if (typeof window === 'undefined') return
    const guardedWindow = window as unknown as GuardedWindow
    if (guardedWindow.__paymentNetworkGaGuardInstalled) return
    guardedWindow.__paymentNetworkGaGuardInstalled = true
    disablePaymentNetworkGoogleAnalytics()

    const wrap = (method: 'pushState' | 'replaceState') => {
        const original = window.history[method].bind(window.history)
        window.history[method] = (data: unknown, unused: string, url?: string | URL | null) => {
            if (url !== undefined && url !== null) {
                try {
                    disablePaymentNetworkGoogleAnalytics(new URL(String(url), window.location.href).pathname)
                } catch {}
            }
            original(data, unused, url)
        }
    }
    wrap('pushState')
    wrap('replaceState')
    window.addEventListener('popstate', () => disablePaymentNetworkGoogleAnalytics())
}
