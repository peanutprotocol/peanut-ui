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

/** Checks whether this device can create a passkey with a local biometric/PIN authenticator. */
export function usePasskeySupport(): PasskeySupportResult {
    const [isSupported, setIsSupported] = useState(false)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [browserSupported, setBrowserSupported] = useState(false)

    const checkSupport = useCallback(async () => {
        setIsLoading(true)
        setError(null)

        try {
            // Native shells use the Capacitor passkey bridge; browser APIs can
            // return false negatives inside their webviews.
            if (isCapacitor()) {
                setBrowserSupported(true)
                setIsSupported(true)
                return
            }

            const basicWebAuthnSupport = browserSupportsWebAuthn()
            setBrowserSupported(basicWebAuthnSupport)
            if (!basicWebAuthnSupport) {
                setIsSupported(false)
                setError('WebAuthn is not available')
                return
            }

            if (typeof window !== 'undefined' && !window.isSecureContext) {
                setIsSupported(false)
                setError('Passkeys require a secure context (HTTPS)')
                return
            }

            const platformAuthenticatorAvailable = await platformAuthenticatorIsAvailable()
            setIsSupported(platformAuthenticatorAvailable)
            if (!platformAuthenticatorAvailable) {
                setError('A platform authenticator is not available')
            }
        } catch (err) {
            console.error('Error checking passkey support:', err)
            setError('Failed to check passkey support')
            setIsSupported(false)
            setBrowserSupported(false)
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
    }, [checkSupport])

    return { isSupported, isLoading, error, browserSupported, recheckSupport }
}
