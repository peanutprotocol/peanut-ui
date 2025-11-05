'use client'

import Script from 'next/script'
import { useEffect, useCallback, useState } from 'react'
import { CRISP_WEBSITE_ID } from '@/constants/crisp'

/**
 * Crisp Proxy Page - Same-origin iframe solution for embedded Crisp chat
 *
 * This page loads the Crisp widget in full-screen mode and is embedded as an iframe
 * from SupportDrawer and SupportPage. By being same-origin, we avoid CORS issues
 * and can fully control the Crisp instance via JavaScript.
 *
 * User data flows via URL parameters and is set during Crisp initialization,
 * following Crisp's recommended pattern for iframe embedding with JS SDK control.
 *
 * iOS FIXES:
 * - Removed Suspense boundary (causes Safari streaming deadlock)
 * - Manual URLSearchParams instead of useSearchParams() hook (hydration issue)
 */
export default function CrispProxyPage() {
    const [searchParams, setSearchParams] = useState<URLSearchParams | null>(null)

    // Parse URL params manually (iOS Safari issue with useSearchParams + Suspense)
    useEffect(() => {
        if (typeof window !== 'undefined') {
            setSearchParams(new URLSearchParams(window.location.search))
        }
    }, [])

    // Memoize notify function to prevent recreation
    const notifyParentReady = useCallback(() => {
        if (typeof window !== 'undefined' && window.parent !== window) {
            window.parent.postMessage({ type: 'CRISP_READY' }, window.location.origin)
        }
    }, [])

    // Set runtime config before Crisp loads
    useEffect(() => {
        if (typeof window === 'undefined') return
        ;(window as any).CRISP_RUNTIME_CONFIG = {
            lock_maximized: true,
            lock_full_view: true,
            cross_origin_cookies: true, // Essential for session persistence in iframes
        }
    }, [])

    // Initialize Crisp with user data
    useEffect(() => {
        if (typeof window === 'undefined' || !searchParams) return

        const email = searchParams.get('user_email')
        const nickname = searchParams.get('user_nickname')
        const avatar = searchParams.get('user_avatar')
        const sessionDataJson = searchParams.get('session_data')
        const prefilledMessage = searchParams.get('prefilled_message')

        const setAllData = () => {
            if (!window.$crisp) return false

            // Check sessionStorage for reset flag (set during logout)
            const needsReset = sessionStorage.getItem('crisp_needs_reset')
            if (needsReset === 'true') {
                window.$crisp.push(['do', 'session:reset'])
                sessionStorage.removeItem('crisp_needs_reset')
            }

            // Set user identification
            if (email) {
                window.$crisp.push(['set', 'user:email', [email]])
            }
            if (nickname) {
                window.$crisp.push(['set', 'user:nickname', [nickname]])
            }
            if (avatar) {
                window.$crisp.push(['set', 'user:avatar', [avatar]])
            }

            // Set session metadata for support agents
            if (sessionDataJson) {
                try {
                    const data = JSON.parse(sessionDataJson)
                    const sessionDataArray = [
                        [
                            ['username', data.username || ''],
                            ['user_id', data.user_id || ''],
                            ['full_name', data.full_name || ''],
                            ['grafana_dashboard', data.grafana_dashboard || ''],
                            ['wallet_address', data.wallet_address || ''],
                            ['bridge_user_id', data.bridge_user_id || ''],
                            ['manteca_user_id', data.manteca_user_id || ''],
                        ],
                    ]
                    window.$crisp.push(['set', 'session:data', sessionDataArray])
                } catch (e) {
                    console.error('[Crisp] Failed to parse session_data:', e)
                }
            }

            if (prefilledMessage) {
                window.$crisp.push(['set', 'message:text', [prefilledMessage]])
            }

            // Wait for Crisp to be fully ready (session loaded and UI rendered)
            window.$crisp.push(['on', 'session:loaded', notifyParentReady])

            // Fallback: notify after a delay if session:loaded doesn't fire
            setTimeout(notifyParentReady, 1500)

            return true
        }

        // Poll for Crisp SDK availability
        const checkCrisp = setInterval(() => {
            if (window.$crisp && setAllData()) {
                clearInterval(checkCrisp)
            }
        }, 100)

        // Safety: Clear polling after 10 seconds
        const timeoutId = setTimeout(() => {
            clearInterval(checkCrisp)
            // Notify parent even if Crisp failed to load to prevent infinite spinner
            notifyParentReady()
        }, 10000)

        // Listen for reset messages from parent window
        const handleMessage = (event: MessageEvent) => {
            if (event.origin !== window.location.origin) return

            if (event.data.type === 'CRISP_RESET_SESSION' && window.$crisp) {
                window.$crisp.push(['do', 'session:reset'])
            }
        }

        window.addEventListener('message', handleMessage)
        return () => {
            window.removeEventListener('message', handleMessage)
            clearInterval(checkCrisp)
            clearTimeout(timeoutId)
        }
    }, [searchParams, notifyParentReady])

    return (
        <div className="h-full w-full">
            <Script strategy="afterInteractive" id="crisp-proxy-widget">
                {`
                    window.$crisp=[];
                    window.CRISP_WEBSITE_ID="${CRISP_WEBSITE_ID}";
                    (function(){
                        d=document;
                        s=d.createElement("script");
                        s.src="https://client.crisp.chat/l.js";
                        s.async=1;
                        d.getElementsByTagName("head")[0].appendChild(s);
                    })();
                    window.$crisp.push(["safe", true]);
                `}
            </Script>
        </div>
    )
}
