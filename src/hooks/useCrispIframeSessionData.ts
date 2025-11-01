import { useEffect, useRef } from 'react'
import { type CrispUserData } from '@/hooks/useCrispUserData'

/**
 * Hook to attempt setting session:data in Crisp iframe via JavaScript
 * This is a best-effort attempt - URL params handle user identification
 * Session metadata (grafana_dashboard, user_id, etc.) cannot be passed via URL params
 * and must be set via JavaScript (which may fail due to CORS)
 */
export function useCrispIframeSessionData(
    iframeRef: React.RefObject<HTMLIFrameElement>,
    userData: CrispUserData,
    prefilledMessage?: string
) {
    useEffect(() => {
        if (!iframeRef.current || !userData.userId) return

        const iframe = iframeRef.current
        const setSessionData = () => {
            try {
                const iframeWindow = iframe.contentWindow as any
                if (iframeWindow?.$crisp) {
                    // Set session:data (metadata) - this appears in Crisp dashboard for support agents
                    // Note: User identification (email, nickname) is already set via URL params
                    iframeWindow.$crisp.push([
                        'set',
                        'session:data',
                        [
                            [
                                ['username', userData.username || ''],
                                ['user_id', userData.userId || ''],
                                ['full_name', userData.fullName || ''],
                                ['grafana_dashboard', userData.grafanaLink || ''],
                            ],
                        ],
                    ])
                    if (prefilledMessage) {
                        iframeWindow.$crisp.push(['set', 'message:text', [prefilledMessage]])
                    }
                    console.log('[Crisp] ✅ Successfully set session metadata via JavaScript')
                }
            } catch (e: any) {
                // CORS error expected - URL params already handle user identification
                if (e.message?.includes('cross-origin') || e.name === 'SecurityError') {
                    console.debug(
                        '[Crisp] Session metadata cannot be set (CORS) - user identification via URL params is sufficient'
                    )
                }
            }
        }

        const handleLoad = () => {
            // Try immediately
            setSessionData()
            // Retry after delays
            setTimeout(setSessionData, 500)
            setTimeout(setSessionData, 2000)
        }

        iframe.addEventListener('load', handleLoad)
        return () => iframe.removeEventListener('load', handleLoad)
    }, [iframeRef, userData, prefilledMessage])
}

