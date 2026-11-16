import { walletPlatformFromUserAgent } from '@/utils/wallet-platform'

export type DeviceOs = 'ios' | 'android' | 'other'
export type InAppBrowser = 'instagram' | 'facebook' | 'x' | 'tiktok' | 'threads' | 'linkedin' | 'other' | 'none'

/**
 * iPadOS Safari sends a desktop Mac user agent by default, so an iPad outside an in-app browser
 * reads as `other` and gets the neutral label. Only a client touch check could tell it apart,
 * and the label is decided on the server (selectCreatorPage).
 */
export function deviceOs(userAgent: string): DeviceOs {
    // The same three-way rule as the card's wallet button; one copy of it.
    return walletPlatformFromUserAgent(userAgent)
}

/**
 * `none` is a browser of its own (Safari, Chrome), the comparison group of the read-out. Chrome Custom
 * Tabs and SFSafariViewController send the browser's own user agent and also read as `none`.
 * `other` is an in-app browser this function does not name.
 */
export function inAppBrowser(userAgent: string): InAppBrowser {
    // Threads calls itself Barcelona. It and Instagram come first: Meta's Android webviews can also carry Facebook's FB_IAB token.
    if (/Barcelona/.test(userAgent)) return 'threads'
    if (/Instagram/.test(userAgent)) return 'instagram'
    if (/FBAN|FBAV|FB_IAB/.test(userAgent)) return 'facebook'
    // `trill` is TikTok's Android app name. Anchored, so it does not match inside another word.
    if (/TikTok|musical_ly|BytedanceWebview|\btrill_|AppName\/trill\b/.test(userAgent)) return 'tiktok'
    if (/Twitter/.test(userAgent)) return 'x'
    if (/LinkedInApp/.test(userAgent)) return 'linkedin'
    // Apps that keep a `Safari/` token on an iPhone, so the generic rule below misses them. `GSA` is the Google app.
    if (/Snapchat|WhatsApp|Telegram|\bGSA\//.test(userAgent)) return 'other'
    // An Android System WebView marks itself with `; wv)`.
    if (/Android.*; wv\)/.test(userAgent)) return 'other'
    // Every real iPhone browser (Safari, Chrome, Firefox, Edge) sends `Safari/`; a bare WKWebView does not.
    if (/iPhone|iPad|iPod/.test(userAgent) && !/Safari\//.test(userAgent)) return 'other'
    return 'none'
}

/**
 * True where the app draws its own controls over about the bottom 60px of the page: the in-app
 * browsers of Instagram and Facebook on an iPhone. The web view keeps its full height there, so
 * no viewport unit, safe-area inset or IntersectionObserver sees the cover; only the user agent
 * tells. A page then lifts its bottom-anchored button (see CreatorPageShell).
 */
export function coversPageBottom(userAgent: string): boolean {
    const browser = inAppBrowser(userAgent)
    return deviceOs(userAgent) === 'ios' && (browser === 'instagram' || browser === 'facebook')
}
