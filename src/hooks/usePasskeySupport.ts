'use client'

import { useCallback, useEffect, useState } from 'react'
import { browserSupportsWebAuthn } from '@simplewebauthn/browser'

export interface PasskeySupportResult {
    isSupported: boolean
    isLoading: boolean
    error: string | null
    browserSupported: boolean
    conditionalMediationSupported: boolean
    recheckSupport: () => void
}

/**
 * Hook to check if the current browser and device support passkeys (WebAuthn)
 * Includes both basic WebAuthn support and conditional mediation (passkey) support
 *
 * @returns {PasskeySupportResult} Object containing support status, loading state, error info, and recheck function
 */
export function usePasskeySupport(): PasskeySupportResult {
    const [isSupported, setIsSupported] = useState(false)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [browserSupported, setBrowserSupported] = useState(false)
    const [conditionalMediationSupported, setConditionalMediationSupported] = useState(false)

    const checkSupport = useCallback(async () => {
        setIsLoading(true)
        setError(null)

        try {
            // Check basic WebAuthn support first
            const basicWebAuthnSupport = browserSupportsWebAuthn()
            setBrowserSupported(basicWebAuthnSupport)

            if (!basicWebAuthnSupport) {
                setIsSupported(false)
                setConditionalMediationSupported(false)
                return
            }

            // Check if running in a secure context (required for WebAuthn)
            if (typeof window !== 'undefined' && !window.isSecureContext) {
                setError('Passkeys require a secure context (HTTPS)')
                setIsSupported(false)
                setConditionalMediationSupported(false)
                return
            }

            // Check passkey (conditional mediation) support
            if (typeof window.PublicKeyCredential?.isConditionalMediationAvailable === 'function') {
                try {
                    const conditionalSupport = await window.PublicKeyCredential.isConditionalMediationAvailable()
                    setConditionalMediationSupported(conditionalSupport)
                    setIsSupported(conditionalSupport)
                } catch (err) {
                    console.warn('Error checking conditional mediation support:', err)
                    setError('Unable to determine passkey support')
                    setIsSupported(false)
                    setConditionalMediationSupported(false)
                }
            } else {
                // Fallback: if conditional mediation API is not available,
                // assume passkeys are not supported but basic WebAuthn might be
                setConditionalMediationSupported(false)
                setIsSupported(false)
            }
        } catch (err) {
            console.error('Error checking passkey support:', err)
            setError('Failed to check passkey support')
            setIsSupported(false)
            setBrowserSupported(false)
            setConditionalMediationSupported(false)
        } finally {
            setIsLoading(false)
        }
    }, [])

    const recheckSupport = useCallback(() => {
        checkSupport()
    }, [checkSupport])

    useEffect(() => {
        // Only run on client side
        if (typeof window === 'undefined') {
            setIsLoading(false)
            return
        }

        checkSupport()
    }, [checkSupport])

    return {
        isSupported,
        isLoading,
        error,
        browserSupported,
        conditionalMediationSupported,
        recheckSupport,
    }
}
