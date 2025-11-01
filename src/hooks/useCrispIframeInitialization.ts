import { useEffect, useRef } from 'react'
import { setCrispUserData } from '@/utils/crisp'
import { type CrispUserData } from '@/hooks/useCrispUserData'

/**
 * Hook to initialize Crisp user data in an iframe (for embedded Crisp chat)
 * Handles CORS-safe initialization and event listeners
 * @param iframeRef - Ref to the iframe element
 * @param userData - User data to set
 * @param prefilledMessage - Optional prefilled message
 * @param enabled - Whether initialization is enabled
 */
export function useCrispIframeInitialization(
    iframeRef: React.RefObject<HTMLIFrameElement>,
    userData: CrispUserData,
    prefilledMessage?: string,
    enabled: boolean = true
) {
    useEffect(() => {
        if (!enabled || !iframeRef.current || !userData.userId) return

        const iframe = iframeRef.current

        const setData = () => {
            try {
                const iframeWindow = iframe.contentWindow as any
                if (!iframeWindow?.$crisp) return

                setCrispUserData(iframeWindow.$crisp, userData, prefilledMessage)
            } catch (e) {
                // Silently fail if CORS blocks access - no harm done
                console.debug('Could not set Crisp data in iframe (expected if CORS-blocked):', e)
            }
        }

        const handleLoad = () => {
            // Try immediately
            setData()

            // Listen for Crisp loaded event in iframe
            try {
                const iframeWindow = iframe.contentWindow as any
                if (iframeWindow?.$crisp) {
                    iframeWindow.$crisp.push(['on', 'session:loaded', setData])
                }
            } catch (e) {
                // Ignore CORS errors
            }

            // Fallback: try once after a delay (simplified from multiple timeouts)
            setTimeout(setData, 1000)
        }

        iframe.addEventListener('load', handleLoad)
        return () => iframe.removeEventListener('load', handleLoad)
    }, [iframeRef, userData, prefilledMessage, enabled])
}
