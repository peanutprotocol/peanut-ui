import { useEffect } from 'react'
import { setCrispUserData } from '@/utils/crisp'
import { type CrispUserData } from './useCrispUserData'

/**
 * Hook to initialize Crisp user data on a given $crisp instance
 * Handles timing, event listeners, and cleanup according to Crisp SDK best practices
 * @param crispInstance - The $crisp object (window.$crisp or iframe.contentWindow.$crisp)
 * @param userData - User data to set
 * @param prefilledMessage - Optional prefilled message
 * @param enabled - Whether initialization is enabled (default: true)
 */
export function useCrispInitialization(
    crispInstance: any,
    userData: CrispUserData,
    prefilledMessage?: string,
    enabled: boolean = true
) {
    useEffect(() => {
        if (!enabled || !userData.userId || !crispInstance) return

        const setData = () => {
            if (crispInstance) {
                setCrispUserData(crispInstance, userData, prefilledMessage)
            }
        }

        // Set data immediately if Crisp is already loaded
        setData()

        // Listen for session loaded event - primary event Crisp fires when ready
        // This ensures data persists across sessions and is set when Crisp initializes
        crispInstance.push(['on', 'session:loaded', setData])

        // Fallback: try once after a delay to catch cases where Crisp loads quickly
        const fallbackTimer = setTimeout(setData, 1000)

        return () => {
            clearTimeout(fallbackTimer)
            if (crispInstance) {
                crispInstance.push(['off', 'session:loaded', setData])
            }
        }
    }, [crispInstance, userData, prefilledMessage, enabled])
}
