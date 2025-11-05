import { useState, useEffect, useCallback } from 'react'
import { useDeviceType, DeviceType } from './useGetDeviceType'

export interface CrispIframeState {
    isReady: boolean
    hasError: boolean
    retry: () => void
}

/**
 * Hook to manage Crisp iframe ready state with device-specific timeouts
 *
 * iOS devices get longer timeout due to stricter security policies and
 * slower script execution in iframe contexts.
 *
 * @param enabled - Whether to listen for ready messages (useful for conditional rendering)
 * @returns Object with isReady, hasError, and retry function
 */
export function useCrispIframeReady(enabled: boolean = true): CrispIframeState {
    const [isReady, setIsReady] = useState(false)
    const [hasError, setHasError] = useState(false)
    const [attemptCount, setAttemptCount] = useState(0)
    const { deviceType } = useDeviceType()

    const retry = useCallback(() => {
        setIsReady(false)
        setHasError(false)
        setAttemptCount((prev) => prev + 1)
    }, [])

    useEffect(() => {
        if (!enabled) return

        let receivedMessage = false

        const handleMessage = (event: MessageEvent) => {
            // Security: Only accept messages from same origin
            if (event.origin !== window.location.origin) return

            if (event.data.type === 'CRISP_READY') {
                if (process.env.NODE_ENV !== 'production') {
                    console.log('[Crisp] Iframe ready signal received')
                }
                receivedMessage = true
                setIsReady(true)
                setHasError(false)
            }
        }

        // Device-specific timeouts:
        // - iOS: 8s (stricter security, slower script execution in PWA)
        // - Others: 3s (normal loading time)
        const timeoutDuration = deviceType === DeviceType.IOS ? 8000 : 3000

        const timeoutId = setTimeout(() => {
            if (!receivedMessage) {
                if (process.env.NODE_ENV !== 'production') {
                    console.warn(
                        `[Crisp] Timeout reached after ${timeoutDuration}ms without CRISP_READY (device: ${deviceType})`
                    )
                }
                setHasError(true)
                setIsReady(true) // Show iframe anyway for manual interaction
            }
        }, timeoutDuration)

        window.addEventListener('message', handleMessage)

        return () => {
            window.removeEventListener('message', handleMessage)
            clearTimeout(timeoutId)
        }
    }, [enabled, deviceType, attemptCount])

    return { isReady, hasError, retry }
}
