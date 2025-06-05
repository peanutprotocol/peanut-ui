import { inAppSignatures } from '../Global/UnsupportedBrowserModal'

// checks user agent against a list of known in-app browser signatures
export const isLikelyWebview = () => {
    if (typeof navigator === 'undefined') return false
    const uaString = navigator.userAgent || navigator.vendor || (window as any).opera
    // pwps running in standalone mode are not considered webviews
    if (typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches) {
        return false
    }
    return inAppSignatures.some((sig) => new RegExp(sig, 'i').test(uaString))
}

// checks if the device os version meets minimum requirements (android 9+, ios 16+)
export const isDeviceOsSupported = (ua: string): boolean => {
    if (!ua) return true // default to supported if ua is unavailable, passkey check is the main gatekeeper
    const androidMatch = ua.match(/Android\s+(\d+)(?:\.(\d+))?(?:\.(\d+))?/i)
    if (androidMatch) {
        const majorVersion = parseInt(androidMatch[1], 10)
        return majorVersion >= 9
    }
    const iosMatch = ua.match(/(?:CPU OS|iPhone OS|iPad; CPU OS)\s+(\d+)(?:_(\d+))?(?:_(\d+))?/i)
    if (iosMatch) {
        const majorVersion = parseInt(iosMatch[1], 10)
        return majorVersion >= 16
    }
    return true // other os types are considered supported by this check
}

// determines device type (ios, android, or desktop) from user agent
export const getDeviceTypeForLogic = (ua: string): 'ios' | 'android' | 'desktop' => {
    if (!ua) return 'desktop'
    const isIOS =
        /iPad|iPhone|iPod/.test(ua) ||
        (typeof navigator !== 'undefined' && navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    const isAndroid = /Android/i.test(ua)
    if (isIOS) return 'ios'
    if (isAndroid) return 'android'
    return 'desktop'
}
