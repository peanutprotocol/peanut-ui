'use client'

import { useCallback, useEffect, useState } from 'react'
import { checkPasskeyCapability, failedPasskeyCapability, type PasskeyCapability } from './passkeySupport.utils'

export interface PasskeySupportResult {
    isSupported: boolean
    isLoading: boolean
    error: string | null
    browserSupported: boolean
    recheckSupport: () => void
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
            setCapability(failedPasskeyCapability())
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
