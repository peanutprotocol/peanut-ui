'use client'

import { useCallback, useEffect, useState } from 'react'
import { browserSupportsWebAuthn, platformAuthenticatorIsAvailable } from '@simplewebauthn/browser'
import { isCapacitor } from '@/utils/capacitor'

export interface PasskeySupportResult {
    isSupported: boolean
    isLoading: boolean
    error: string | null
    browserSupported: boolean
    recheckSupport: () => void
}

type PasskeyCapability = Pick<PasskeySupportResult, 'isSupported' | 'error' | 'browserSupported'>

const unsupported = (error: string, browserSupported: boolean): PasskeyCapability => ({
    isSupported: false,
    error,
    browserSupported,
})

const checkPasskeyCapability = async (): Promise<PasskeyCapability> => {
    // Native shells use the Capacitor passkey bridge; browser APIs can return
    // false negatives inside their webviews.
    if (isCapacitor()) {
        return { isSupported: true, error: null, browserSupported: true }
    }

    const basicWebAuthnSupport = browserSupportsWebAuthn()
    if (!basicWebAuthnSupport) {
        return unsupported('WebAuthn is not available', false)
    }

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

    const platformAuthenticatorAvailable = await platformAuthenticatorIsAvailable()
    return platformAuthenticatorAvailable
        ? { isSupported: true, error: null, browserSupported: true }
        : unsupported('A platform authenticator is not available', true)
}

/** Checks whether this environment has a usable path to create a passkey. */
export function usePasskeySupport(): PasskeySupportResult {
    const [capability, setCapability] = useState<PasskeyCapability>({
        isSupported: false,
        error: null,
        browserSupported: false,
    })
    const [isLoading, setIsLoading] = useState(true)

    const checkSupport = useCallback(async () => {
        setIsLoading(true)

        try {
            setCapability(await checkPasskeyCapability())
        } catch (err) {
            console.error('Error checking passkey support:', err)
            setCapability(unsupported('Failed to check passkey support', false))
        } finally {
            setIsLoading(false)
        }
    }, [])

    const recheckSupport = useCallback(() => {
        void checkSupport()
    }, [checkSupport])

    useEffect(() => {
        if (typeof window === 'undefined') {
            setIsLoading(false)
            return
        }

        void checkSupport()

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                void checkSupport()
            }
        }
        document.addEventListener('visibilitychange', handleVisibilityChange)
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
    }, [checkSupport])

    return { ...capability, isLoading, recheckSupport }
}
