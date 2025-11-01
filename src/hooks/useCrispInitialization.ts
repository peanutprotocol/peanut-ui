import { useEffect } from 'react'
import { setCrispUserData } from '@/utils/crisp'
import { type CrispUserData } from './useCrispUserData'

/**
 * Initializes Crisp user data on the main window $crisp instance
 *
 * Used for the main Crisp widget (not iframe). Sets user identification and metadata
 * using event listeners for proper timing.
 *
 * @param crispInstance - The $crisp object (window.$crisp)
 * @param userData - User data to set
 * @param prefilledMessage - Optional prefilled message
 * @param enabled - Whether initialization is enabled
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

        setData()
        crispInstance.push(['on', 'session:loaded', setData])

        const fallbackTimer = setTimeout(setData, 1000)

        return () => {
            clearTimeout(fallbackTimer)
            if (crispInstance) {
                crispInstance.push(['off', 'session:loaded', setData])
            }
        }
    }, [crispInstance, userData, prefilledMessage, enabled])
}
