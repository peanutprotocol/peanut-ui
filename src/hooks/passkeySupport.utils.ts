import { browserSupportsWebAuthn, platformAuthenticatorIsAvailable } from '@simplewebauthn/browser'
import { isCapacitor } from '@/utils/capacitor'

export type PasskeyCapability = {
    isSupported: boolean
    error: string | null
    browserSupported: boolean
}

const unsupported = (error: string, browserSupported: boolean): PasskeyCapability => ({
    isSupported: false,
    error,
    browserSupported,
})

export const checkPasskeyCapability = async (): Promise<PasskeyCapability> => {
    // Native shells use the Capacitor passkey bridge; browser APIs can return
    // false negatives inside their webviews.
    if (isCapacitor()) {
        return { isSupported: true, error: null, browserSupported: true }
    }

    const basicWebAuthnSupport = browserSupportsWebAuthn()
    if (!basicWebAuthnSupport) return unsupported('WebAuthn is not available', false)

    if (typeof window !== 'undefined' && !window.isSecureContext) {
        return unsupported('Passkeys require a secure context (HTTPS)', true)
    }

    // Desktop browsers can create a credential through a QR/hybrid ceremony
    // or a security key even when no authenticator is attached locally. Mobile
    // Android and iOS need the on-device probe: it also prevents Safari-looking
    // iOS webviews with unusable WebAuthn from bypassing the invite gate.
    const isMobileDevice =
        /android|iphone|ipad|ipod/i.test(navigator.userAgent) ||
        (/macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1)
    if (!isMobileDevice) {
        return { isSupported: true, error: null, browserSupported: true }
    }

    return (await platformAuthenticatorIsAvailable())
        ? { isSupported: true, error: null, browserSupported: true }
        : unsupported('A platform authenticator is not available', true)
}

export const failedPasskeyCapability = (): PasskeyCapability => unsupported('Failed to check passkey support', false)
