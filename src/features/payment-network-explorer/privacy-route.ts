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

export function googleAnalyticsBootstrapScript(measurementId: string): string {
    if (!/^[A-Za-z0-9_-]+$/.test(measurementId)) return ''
    const id = JSON.stringify(measurementId)
    const path = JSON.stringify(PAYMENT_NETWORK_PATH)
    return `(()=>{const id=${id};const path=${path};const disabled='ga-disable-'+id;const privatePath=location.pathname===path||location.pathname.startsWith(path+'/');if(privatePath){window[disabled]=true;return;}window.dataLayer=window.dataLayer||[];window.gtag=function(){window.dataLayer.push(arguments)};window.gtag('js',new Date());window.gtag('config',id);const script=document.createElement('script');script.async=true;script.src='https://www.googletagmanager.com/gtag/js?id='+encodeURIComponent(id);document.head.appendChild(script)})()`
}
