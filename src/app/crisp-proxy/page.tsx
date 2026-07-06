'use client'

import Script from 'next/script'
import { useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
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
 */
function CrispProxyContent() {
    const searchParams = useSearchParams()

    useEffect(() => {
        if (typeof window === 'undefined') return

        const email = searchParams.get('user_email')
        const nickname = searchParams.get('user_nickname')
        const avatar = searchParams.get('user_avatar')
        const sessionDataJson = searchParams.get('session_data')
        const prefilledMessage = searchParams.get('prefilled_message')
        const currentTokenId = searchParams.get('crisp_token_id')

        // Notify the parent (SupportDrawer) exactly once — either ready or failed —
        // so a spinner never hangs forever and a failure surfaces a fallback UI.
        let notified = false
        const notifyParent = (type: 'CRISP_READY' | 'CRISP_FAILED') => {
            if (notified) return
            notified = true
            if (window.parent !== window) {
                window.parent.postMessage({ type }, window.location.origin)
            }
        }
        const notifyParentReady = () => notifyParent('CRISP_READY')
        const notifyParentFailed = () => notifyParent('CRISP_FAILED')

        // Crisp upgrades the $crisp array in place once l.js loads, adding methods.
        const crispScriptLoaded = () => typeof window.$crisp?.is === 'function'

        const setAllData = () => {
            if (!window.$crisp) return false

            // Reset the Crisp session whenever the identity changes, so Crisp binds
            // the new token to a clean session. Two independent triggers:
            //  1. explicit logout flag (sessionStorage) — set at logout, but per-tab
            //     and wiped on app restart, so it is routinely missed on multi-account
            //     devices.
            //  2. token mismatch vs the last identity we loaded (localStorage) —
            //     survives restarts. Crisp silently refuses to bind a new token over a
            //     persisted session without a reset first, which is what leaves the
            //     chatbox blank for users who have hosted more than one account.
            const needsReset = sessionStorage.getItem('crisp_needs_reset') === 'true'
            const lastTokenId = localStorage.getItem('crisp_last_token_id') ?? ''
            const tokenChanged = lastTokenId !== (currentTokenId ?? '')
            if (needsReset || tokenChanged) {
                window.$crisp.push(['do', 'session:reset'])
                sessionStorage.removeItem('crisp_needs_reset')
            }
            localStorage.setItem('crisp_last_token_id', currentTokenId ?? '')

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
                            ['posthog_person', data.posthog_person || ''],
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

            return true
        }

        // Initialize data once Crisp loads
        if (window.$crisp) {
            setAllData()
        } else {
            const checkCrisp = setInterval(() => {
                if (window.$crisp) {
                    setAllData()
                    clearInterval(checkCrisp)
                }
            }, 100)

            setTimeout(() => clearInterval(checkCrisp), 5000)
        }

        // Readiness watchdog. session:loaded is the real "chatbox is up" signal, but it
        // doesn't always fire. After 8s, if we haven't already reported ready, decide:
        //  - the Crisp bundle errored or never upgraded the $crisp stub  → report FAILED
        //    (parent shows a fallback so the user isn't stuck on a blank panel).
        //  - the bundle loaded but session:loaded didn't fire            → report READY
        //    (assume the chatbox rendered — preserves the prior fallback behaviour).
        const readinessTimer = setTimeout(() => {
            if (window.__crispLoadFailed || !crispScriptLoaded()) {
                notifyParentFailed()
            } else {
                notifyParentReady()
            }
        }, 8000)

        // Listen for reset messages from parent window
        const handleMessage = (event: MessageEvent) => {
            if (event.origin !== window.location.origin) return

            if (event.data.type === 'CRISP_RESET_SESSION' && window.$crisp) {
                window.CRISP_TOKEN_ID = null
                window.$crisp.push(['do', 'session:reset'])
            }
        }

        window.addEventListener('message', handleMessage)
        return () => {
            clearTimeout(readinessTimer)
            window.removeEventListener('message', handleMessage)
        }
    }, [searchParams])

    return (
        <div className="h-full w-full" style={{ height: '100vh', width: '100vw', overflow: 'hidden' }}>
            <Script strategy="afterInteractive" id="crisp-proxy-widget">
                {`
                    window.$crisp=[];
                    window.CRISP_WEBSITE_ID="${CRISP_WEBSITE_ID}";
                    window.CRISP_RUNTIME_CONFIG={lock_maximized:true,lock_full_view:true,cross_origin_cookies:true};
                    (function(){
                        var t=new URLSearchParams(window.location.search).get("crisp_token_id");
                        if(t) window.CRISP_TOKEN_ID=t;
                    })();
                    (function(){
                        var d=document;
                        var s=d.createElement("script");
                        s.src="https://client.crisp.chat/l.js";
                        s.async=1;
                        s.onerror=function(){window.__crispLoadFailed=true;};
                        d.getElementsByTagName("head")[0].appendChild(s);
                    })();
                    window.$crisp.push(["safe", true]);
                `}
            </Script>
        </div>
    )
}

export default function CrispProxyPage() {
    return (
        <Suspense fallback={<div className="h-full w-full" />}>
            <CrispProxyContent />
        </Suspense>
    )
}
