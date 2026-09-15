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
    // or a security key even when no authenticator is attached locally. The
    // on-device authenticator is a hard prerequisite only on Android, where a
    // false result usually means screen lock or Credential Manager is missing.
    if (!/android/i.test(navigator.userAgent)) {
        return { isSupported: true, error: null, browserSupported: true }
    }

    return (await platformAuthenticatorIsAvailable())
        ? { isSupported: true, error: null, browserSupported: true }
        : unsupported('A platform authenticator is not available', true)
}

export const failedPasskeyCapability = (): PasskeyCapability => unsupported('Failed to check passkey support', false)
