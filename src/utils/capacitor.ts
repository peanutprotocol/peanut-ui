// platform detection and api routing for capacitor native app

/**
 * returns true when running inside a capacitor webview (ios or android native app)
 *
 * checks window.Capacitor (set by capacitor bridge) and falls back to
 * NEXT_PUBLIC_CAPACITOR_BUILD env var for remote url testing where the
 * bridge may not be injected
 */
export function isCapacitor(): boolean {
    if (typeof window === 'undefined') return false
    // primary check: capacitor bridge injects this global
    if ((window as any).Capacitor) return true
    // fallback for remote server.url testing: env var set in vercel preview
    if (process.env.NEXT_PUBLIC_CAPACITOR_BUILD === 'true') return true
    return false
}

/**
 * returns the platform the app is running on
 */
export function getPlatform(): 'web' | 'ios-native' | 'android-native' | 'ios-pwa' | 'android-pwa' {
    if (typeof window === 'undefined') return 'web'

    const capacitor = (window as any).Capacitor
    if (capacitor) {
        const platform = capacitor.getPlatform?.()
        if (platform === 'ios') return 'ios-native'
        if (platform === 'android') return 'android-native'
    }

    const ua = navigator.userAgent.toLowerCase()
    const isStandalone =
        window.matchMedia?.('(display-mode: standalone)')?.matches || (window.navigator as any).standalone === true

    if (isStandalone) {
        if (/iphone|ipad|ipod/.test(ua)) return 'ios-pwa'
        if (/android/.test(ua)) return 'android-pwa'
    }

    return 'web'
}

/**
 * returns true when running on android inside capacitor
 */
export function isAndroidNative(): boolean {
    return getPlatform() === 'android-native'
}

/**
 * returns true when running on ios inside capacitor
 */
export function isIOSNative(): boolean {
    return getPlatform() === 'ios-native'
}

/**
 * returns the base url for api calls
 * - in capacitor: returns the production backend url (since /api/ routes don't exist in static export)
 * - on web: returns empty string (relative paths work via next.js proxy)
 */
export function getApiBaseUrl(): string {
    if (isCapacitor()) {
        return process.env.NEXT_PUBLIC_BASE_URL || 'https://peanut.me'
    }
    return ''
}

/**
 * opens a url in the appropriate way for the current platform
 * - on web: window.open with _blank
 * - in capacitor: uses @capacitor/browser plugin
 */
export async function openExternalUrl(url: string): Promise<void> {
    if (isCapacitor()) {
        try {
            // @ts-ignore -- @capacitor/browser may not be installed yet
            const mod = await import('@capacitor/browser')
            await mod.Browser.open({ url })
        } catch {
            // fallback if plugin not installed
            window.location.href = url
        }
    } else {
        window.open(url, '_blank')
    }
}
