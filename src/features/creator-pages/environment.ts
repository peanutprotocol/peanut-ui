export type DeviceOs = 'ios' | 'android' | 'other'
export type InAppBrowser = 'instagram' | 'facebook' | 'x' | 'tiktok' | 'threads' | 'linkedin' | 'none'

/**
 * iPadOS Safari sends a desktop Mac user agent by default, so an iPad outside an in-app browser
 * reads as `other` and gets the neutral label. Only a client touch check could tell it apart,
 * and the label is decided on the server (CreatorPageShell).
 */
export function deviceOs(userAgent: string): DeviceOs {
    if (/iPhone|iPad|iPod/.test(userAgent)) return 'ios'
    if (/Android/.test(userAgent)) return 'android'
    return 'other'
}

/** Chrome Custom Tabs and SFSafariViewController send the browser's own user agent and read as `none`. */
export function inAppBrowser(userAgent: string): InAppBrowser {
    // Threads calls itself Barcelona. It and Instagram come first: Meta's Android webviews can also carry Facebook's FB_IAB token.
    if (/Barcelona/.test(userAgent)) return 'threads'
    if (/Instagram/.test(userAgent)) return 'instagram'
    if (/FBAN|FBAV|FB_IAB/.test(userAgent)) return 'facebook'
    // `trill` is TikTok's Android app name. Anchored, so it does not match inside another word.
    if (/TikTok|musical_ly|BytedanceWebview|\btrill_|AppName\/trill\b/.test(userAgent)) return 'tiktok'
    if (/Twitter/.test(userAgent)) return 'x'
    if (/LinkedInApp/.test(userAgent)) return 'linkedin'
    return 'none'
}
