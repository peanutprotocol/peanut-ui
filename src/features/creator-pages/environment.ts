export type DeviceOs = 'ios' | 'android' | 'other'
export type InAppBrowser = 'instagram' | 'facebook' | 'x' | 'tiktok' | 'none'

/** An iPad that asks for the desktop site reports as a Mac and reads as `other`. */
export function deviceOs(userAgent: string): DeviceOs {
    if (/iPhone|iPad|iPod/.test(userAgent)) return 'ios'
    if (/Android/.test(userAgent)) return 'android'
    return 'other'
}

export function inAppBrowser(userAgent: string): InAppBrowser {
    // Instagram first: its Android webview can also carry Facebook's FB_IAB token.
    if (/Instagram/.test(userAgent)) return 'instagram'
    if (/FBAN|FBAV|FB_IAB/.test(userAgent)) return 'facebook'
    if (/TikTok|musical_ly|BytedanceWebview|trill/.test(userAgent)) return 'tiktok'
    if (/Twitter/.test(userAgent)) return 'x'
    return 'none'
}
