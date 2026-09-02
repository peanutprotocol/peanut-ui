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
    const cap = window.Capacitor
    if (cap?.isNativePlatform?.()) return true
    if (IS_CAPACITOR_BUILD) return true
    return false
}

/**
 * true ONLY when the capacitor native bridge is actually present.
 *
 * Unlike {@link isCapacitor}, this ignores NEXT_PUBLIC_CAPACITOR_BUILD, which
 * is baked into web builds (vercel previews) where there is no bridge at all.
 * Use this to decide whether a NATIVE api will really work; use isCapacitor()
 * for build-flavor questions.
 */
export function isNativeBridge(): boolean {
    if (typeof window === 'undefined') return false
    return !!window.Capacitor?.isNativePlatform?.()
}

/**
 * returns the platform the app is running on
 */
export function getPlatform(): 'web' | 'ios-native' | 'android-native' | 'ios-pwa' | 'android-pwa' {
    if (typeof window === 'undefined') return 'web'

    const capacitor = window.Capacitor
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
        window.matchMedia?.('(display-mode: standalone)')?.matches || window.navigator.standalone === true

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
 * true only when the native bridge is live AND the platform is android.
 *
 * Unlike {@link isAndroidNative} this is false on capacitor-flavoured WEB
 * builds (vercel previews opened in android chrome), where native-only
 * signals such as the in-app browser's `browserFinished` never arrive.
 */
export function isAndroidNativeBridge(): boolean {
    return isNativeBridge() && window.Capacitor?.getPlatform?.() === 'android'
}

/**
 * returns true when running on ios inside capacitor
 */
export function isIOSNative(): boolean {
    return getPlatform() === 'ios-native'
}

/**
 * The export's stylesheet needs `@layer` (Safari 15.4), `color-mix(in oklab)`
 * (16.2) and `@property` (16.4); a WebView missing any of them paints the app
 * unstyled, so ClientProviders swaps in UnsupportedWebViewScreen instead.
 */
export function isWebViewCssSupported(): boolean {
    if (typeof window === 'undefined') return true
    return (
        'CSSLayerBlockRule' in window &&
        typeof CSS !== 'undefined' &&
        CSS.supports('color', 'color-mix(in oklab, red, red)') &&
        'CSSPropertyRule' in window
    )
}

const ANDROID_MAJOR_TO_SDK: Record<number, number> = { 9: 28, 10: 29, 11: 30, 12: 31, 13: 33, 14: 34, 15: 35, 16: 36 }

/** SDK level from the `Android N` UA token; null when absent or unmapped. */
export function androidSdkFromUserAgent(ua: string): number | null {
    const major = Number(/Android (\d+)/.exec(ua)?.[1])
    return ANDROID_MAJOR_TO_SDK[major] ?? null
}

const SAFE_AREA_EDGES = ['top', 'right', 'bottom', 'left'] as const

function setInlineSafeAreaInsets(value: '0px' | null): void {
    for (const edge of SAFE_AREA_EDGES) {
        const property = `--safe-area-inset-${edge}`
        if (value === null) document.documentElement.style.removeProperty(property)
        else document.documentElement.style.setProperty(property, value)
    }
}

/**
 * Synchronous first pass of {@link zeroLegacyAndroidSafeAreaInsets} from the
 * user agent so the first paint never shows the phantom band; the Device.getInfo
 * pass stays authoritative and un-zeroes if the UA lied.
 */
export function applyLegacyAndroidSafeAreaZeroFromUserAgent(): void {
    if (!isAndroidNative()) return
    const sdk = androidSdkFromUserAgent(navigator.userAgent)
    if (sdk !== null && sdk < 35) setInlineSafeAreaInsets('0px')
}

/**
 * Below Android 15 the app window is never edge-to-edge (enforcement starts at
 * SDK 35), so the webview never extends under the system bars and the correct
 * safe-area inset is zero on every edge — but some WebViews still report
 * nonzero env(safe-area-inset-*), which draws a phantom status-bar band below
 * the real status bar. Capacitor's native inset injection is 15+ only, so on
 * older Android we occupy the same slot ourselves: the inline style on <html>
 * that outranks the env() seed in globals.css (see the :root contract there).
 * No-op on web and iOS; on Android 15+ it clears a zeroing the UA pass got wrong.
 */
export async function zeroLegacyAndroidSafeAreaInsets(): Promise<void> {
    if (!isAndroidNative()) return
    try {
        const { Device } = await import('@capacitor/device')
        const { androidSDKVersion } = await Device.getInfo()
        if (!androidSDKVersion) return
        setInlineSafeAreaInsets(androidSDKVersion >= 35 ? null : '0px')
    } catch {
        // older binary running OTA'd JS without @capacitor/device — keep the env() seed
    }
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
/*
 * Whether OUR in-app browser sheet is (probably) up — set on every
 * openExternalUrl, cleared by browserFinished (wired in useNativeAppLinks) and
 * by closeInAppBrowser. Lets a deep link that arrives while the sheet is open
 * (the Persona/Bridge KYC return leg) close it before navigating, instead of
 * routing underneath a full-screen browser.
 */
let inAppBrowserOpen = false

export function markInAppBrowserClosed(): void {
    inAppBrowserOpen = false
}

/**
 * Dispatched on `document` once closeInAppBrowser has settled. The iOS plugin's
 * close() dismisses the sheet without emitting `browserFinished`, so anything
 * waiting on the sheet (hosted verification) must listen to both.
 */
export const IN_APP_BROWSER_CLOSED_EVENT = 'peanut:in-app-browser-closed'

export async function closeInAppBrowser(): Promise<void> {
    if (!inAppBrowserOpen || !isCapacitor()) return
    inAppBrowserOpen = false
    try {
        const { Browser } = await import('@capacitor/browser')
        await Browser.close()
    } catch {
        // Browser.close rejects when the sheet is already gone — fine.
    } finally {
        document.dispatchEvent(new CustomEvent(IN_APP_BROWSER_CLOSED_EVENT))
    }
}

export async function openExternalUrl(url: string): Promise<void> {
    if (isCapacitor()) {
        const { Browser } = await import('@capacitor/browser')
        inAppBrowserOpen = true
        await Browser.open({ url })
    } else if (!window.open(url, '_blank')) {
        // WhatsApp/Instagram in-app browsers block window.open — the guest
        // store bounce was a silent dead tap there. Navigate in place instead.
        window.location.assign(url)
    }
}

// Android convention for back with nothing to go back to; iOS has no minimize.
export async function minimizeNativeApp(): Promise<void> {
    if (!isNativeBridge()) return
    try {
        const { App } = await import('@capacitor/app')
        await App.minimizeApp()
    } catch {}
}
