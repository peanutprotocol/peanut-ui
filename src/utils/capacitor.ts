// platform detection and api routing for capacitor native app

// env var baked in at build time — set in vercel preview for this branch
const IS_CAPACITOR_BUILD = process.env.NEXT_PUBLIC_CAPACITOR_BUILD === 'true'

/**
 * returns true when running inside a capacitor webview (ios or android native app)
 *
 * detection order:
 * 1. window.Capacitor (set by capacitor bridge — works for local/static builds)
 * 2. NEXT_PUBLIC_CAPACITOR_BUILD env var (baked at build time — works for remote server.url)
 */
export function isCapacitor(): boolean {
    if (typeof window === 'undefined') return false
    // check isNativePlatform() — not just window.Capacitor existence.
    // @capacitor/core sets window.Capacitor on ALL platforms (including web) when bundled.
    // only return true if the native bridge is actually active.
    const cap = (window as any).Capacitor
    if (cap?.isNativePlatform?.()) return true
    if (IS_CAPACITOR_BUILD) return true
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

    // when loading from remote server.url, window.Capacitor may not exist
    // fall back to env var + user agent to determine platform
    if (IS_CAPACITOR_BUILD) {
        const ua = navigator.userAgent
        if (/Android/i.test(ua)) return 'android-native'
        if (/iPhone|iPad|iPod/i.test(ua)) return 'ios-native'
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
 * returns the rpId for native passkey operations.
 * configurable via NEXT_PUBLIC_NATIVE_RP_ID env var, defaults to production domain.
 */
export function getNativeRpId(): string {
    return process.env.NEXT_PUBLIC_NATIVE_RP_ID || 'peanut.me'
}

/**
 * opens a url in the appropriate way for the current platform
 * - on web: window.open with _blank
 * - in capacitor: uses @capacitor/browser plugin
 */
export async function openExternalUrl(url: string): Promise<void> {
    if (isCapacitor()) {
        const { Browser } = await import('@capacitor/browser')
        await Browser.open({ url })
    } else {
        window.open(url, '_blank')
    }
}
