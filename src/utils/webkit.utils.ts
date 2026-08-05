export function getIOSMajorVersion(): number | null {
    if (typeof navigator === 'undefined') return null
    const match = navigator.userAgent.match(/(?:CPU OS|iPhone OS)\s+(\d+)/i)
    return match ? parseInt(match[1], 10) : null
}

/*
 * Animated WebP renders as a static first frame below iOS 16, and the devices capped
 * at iOS 16 (iPhone 8/X, A11 and older) decode it too slowly to hold the frame rate.
 * Anything that can run iOS 17 decodes it fine. Desktop Safari and iPadOS both report
 * a frozen "Macintosh" UA (and Macs need macOS 13+ for animated WebP), so they can't
 * be verified either. Use this to fall back to universally-supported formats (GIF);
 * it is NOT a low-end-hardware signal — it matches fast Macs too.
 */
export function isLegacyWebKit(): boolean {
    if (typeof navigator === 'undefined') return false
    const iosVersion = getIOSMajorVersion()
    if (iosVersion !== null) return iosVersion < 17
    const ua = navigator.userAgent
    if (!/Macintosh/.test(ua)) return false
    const isMacSafari = /AppleWebKit/.test(ua) && /Safari/.test(ua) && !/Chrome|CriOS|Edg|OPR|Firefox/.test(ua)
    return isMacSafari || navigator.maxTouchPoints > 1
}
