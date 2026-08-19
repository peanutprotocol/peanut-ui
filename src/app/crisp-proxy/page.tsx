'use client'

import { useEffect } from 'react'
import {
    CRISP_WEBSITE_ID,
    CRISP_PROXY_REQUEST_INIT_MSG,
    CRISP_PROXY_INIT_MSG,
    type CrispInitPayload,
} from '@/constants/crisp'
import { setCrispUserData } from '@/utils/crisp'

/**
 * Crisp Proxy Page - Same-origin iframe solution for embedded Crisp chat
 *
 * This page loads the Crisp widget in full-screen mode and is embedded as an iframe
 * from SupportDrawer. By being same-origin, we avoid CORS issues and can fully
 * control the Crisp instance via JavaScript.
 *
 * User data arrives via a postMessage handshake, never via the URL. This page asks
 * the parent for it (CRISP_PROXY_REQUEST_INIT) and boots Crisp only once the reply
 * (CRISP_PROXY_INIT) lands. A query string is not a private channel: it rides into
 * Vercel logs, browser history, Referer headers, and the $current_url of every
 * analytics event fired from this document (2026-08-10 postmortem F5). The pull
 * model also solves the timing problem the old URL transport was built to avoid —
 * the iframe initiates, so the parent can never post before this page listens.
 */
/**
 * Push identity/metadata to the widget — used at boot and on later payload updates.
 * `withPrefill` guards message:text: re-pushing an unchanged prefill on a routine
 * metadata refresh would overwrite whatever the user is typing in the composer,
 * so only boot and a genuinely new prefill may set it.
 */
function applyUserData(payload: CrispInitPayload | null, withPrefill: boolean) {
    if (!window.$crisp) return
    const prefill = withPrefill ? payload?.prefilledMessage : undefined
    // skip the all-empty push for anonymous visitors — nothing to show agents
    if (payload?.userData && Object.values(payload.userData).some(Boolean)) {
        setCrispUserData(window.$crisp, payload.userData, prefill)
    } else if (prefill) {
        window.$crisp.push(['set', 'message:text', [prefill]])
    }
}

function bootCrisp(payload: CrispInitPayload | null, onSessionLoaded: () => void) {
    // Everything must be queued on the $crisp stub BEFORE l.js is injected, so the
    // widget initializes with the token, locale and identity in one shot.
    window.$crisp = []
    window.CRISP_WEBSITE_ID = CRISP_WEBSITE_ID
    window.CRISP_RUNTIME_CONFIG = {
        lock_maximized: true,
        lock_full_view: true,
        cross_origin_cookies: true,
        ...(payload?.locale ? { locale: payload.locale } : {}),
    }
    if (payload?.tokenId) {
        window.CRISP_TOKEN_ID = payload.tokenId
    }
    window.$crisp.push(['safe', true])

    // Reset the Crisp session whenever the identity changes, so Crisp binds
    // the new token to a clean session. Two independent triggers:
    //  1. explicit logout flag (sessionStorage) — set at logout, but per-tab
    //     and wiped on app restart, so it is routinely missed on multi-account
    //     devices.
    //  2. token mismatch vs the last identity we loaded (localStorage) —
    //     survives restarts. Crisp silently refuses to bind a new token over a
    //     persisted session without a reset first, which is what leaves the
    //     chatbox blank for users who have hosted more than one account.
    let needsReset = false
    let lastTokenId = ''
    try {
        needsReset = sessionStorage.getItem('crisp_needs_reset') === 'true'
        lastTokenId = localStorage.getItem('crisp_last_token_id') ?? ''
    } catch {
        // storage blocked (private mode / partitioned iframe) — fall back to no
        // stored identity; the token-change check below still triggers a reset,
        // and identity/session setup below proceeds instead of aborting.
    }
    if (needsReset || lastTokenId !== (payload?.tokenId ?? '')) {
        window.$crisp.push(['do', 'session:reset'])
        try {
            sessionStorage.removeItem('crisp_needs_reset')
        } catch {
            // storage blocked — the flag couldn't have been read as true anyway.
        }
    }
    // NB: crisp_last_token_id is persisted once Crisp confirms the session actually
    // loaded (notifyParentReady) — not here, so a failed load still resets on Retry.

    applyUserData(payload, true)

    // Wait for Crisp to be fully ready (session loaded and UI rendered)
    window.$crisp.push(['on', 'session:loaded', onSessionLoaded])

    const script = document.createElement('script')
    script.src = 'https://client.crisp.chat/l.js'
    script.async = true
    script.onerror = () => {
        window.__crispLoadFailed = true
    }
    document.head.appendChild(script)
}

export default function CrispProxyPage() {
    useEffect(() => {
        // booted guards double-boot within this effect run; the window flag guards
        // React strict-mode re-running the effect (booting twice would clobber the
        // $crisp queue and inject l.js twice). A retry remounts the iframe (fresh
        // window), so per-window scope is right.
        let booted = false
        let bootedTokenId = ''
        // last prefill actually applied — lets updates distinguish "new prefill from a
        // new support entry point" (apply) from "same prefill riding along on a
        // metadata refresh" (never re-apply, it would clobber the user's typing)
        let appliedPrefill: string | undefined

        // Report readiness to the parent (SupportDrawer). A READY may supersede an earlier
        // FAILED: on a slow connection the 8s watchdog can post FAILED before the chatbox
        // finishes loading, and the later session:loaded must still be able to dismiss the
        // fallback. Once READY has been sent, FAILED never fires. Each is sent at most once.
        let readyNotified = false
        let failedNotified = false
        const postToParent = (message: { type: string }) => {
            if (window.parent !== window) {
                window.parent.postMessage(message, window.location.origin)
            }
        }
        const notifyParentReady = () => {
            if (readyNotified) return
            readyNotified = true
            // Record the identity as loaded only now that Crisp has confirmed ready —
            // writing it optimistically would let a failed load skip the reset on Retry.
            try {
                localStorage.setItem('crisp_last_token_id', bootedTokenId)
            } catch {
                // storage blocked (private mode / partitioned iframe) — the token-change
                // reset simply re-fires on the next load, which is harmless.
            }
            postToParent({ type: 'CRISP_READY' })
        }
        const notifyParentFailed = () => {
            if (failedNotified || readyNotified) return
            failedNotified = true
            postToParent({ type: 'CRISP_FAILED' })
        }

        // Crisp upgrades the $crisp array in place once l.js loads, adding methods.
        const crispScriptLoaded = () => typeof window.$crisp?.is === 'function'

        const boot = (payload: CrispInitPayload | null) => {
            if (booted) return
            booted = true
            bootedTokenId = payload?.tokenId ?? ''
            appliedPrefill = payload?.prefilledMessage
            // Already booted by a previous effect run (React strict mode re-runs the
            // effect): adopt the state instead of clobbering the $crisp queue and
            // injecting l.js twice. The watchdog below then judges the live widget.
            if (window.__crispProxyBooted) return
            window.__crispProxyBooted = true
            bootCrisp(payload, notifyParentReady)
        }

        // Handshake: ask the parent for the init payload, re-asking until it answers.
        // The parent registers its listener long before this iframe mounts, so the
        // first request normally lands; the interval covers a dropped message. If no
        // reply ever comes, the readiness watchdog below reports CRISP_FAILED.
        const requestTimer = setInterval(() => {
            if (!booted) postToParent({ type: CRISP_PROXY_REQUEST_INIT_MSG })
            else clearInterval(requestTimer)
        }, 250)

        const handleMessage = (event: MessageEvent) => {
            if (event.origin !== window.location.origin) return

            if (event.data?.type === CRISP_PROXY_INIT_MSG) {
                clearInterval(requestTimer)
                const payload = (event.data.payload as CrispInitPayload | undefined) ?? null
                if (!booted) {
                    boot(payload)
                } else {
                    // the parent re-sends the payload when it changes (new email/name
                    // during onboarding, fresh prefill) — apply it live instead of
                    // remounting the whole embedded app. Token/locale changes remount
                    // via the iframe key, so those never take this path.
                    const prefillChanged = payload?.prefilledMessage !== appliedPrefill
                    applyUserData(payload, prefillChanged)
                    if (prefillChanged) appliedPrefill = payload?.prefilledMessage
                }
            } else if (event.data?.type === 'CRISP_RESET_SESSION' && window.$crisp) {
                window.CRISP_TOKEN_ID = null
                window.$crisp.push(['do', 'session:reset'])
            }
        }
        window.addEventListener('message', handleMessage)

        if (window.parent === window) {
            // Direct /crisp-proxy visit — no parent to ask; boot an anonymous session.
            clearInterval(requestTimer)
            boot(null)
        } else {
            postToParent({ type: CRISP_PROXY_REQUEST_INIT_MSG })
        }

        // Readiness watchdog. session:loaded is the real "chatbox is up" signal, but it
        // doesn't always fire. After 8s, if we haven't already reported ready, decide:
        //  - no init payload arrived, the Crisp bundle errored, or it never upgraded
        //    the $crisp stub → report FAILED (parent shows a fallback so the user
        //    isn't stuck on a blank panel).
        //  - the bundle loaded but session:loaded didn't fire → report READY
        //    (assume the chatbox rendered — preserves the prior fallback behaviour).
        const readinessTimer = setTimeout(() => {
            if (!booted || window.__crispLoadFailed || !crispScriptLoaded()) {
                // stop the request loop too — the handshake is declared dead
                clearInterval(requestTimer)
                notifyParentFailed()
            } else {
                notifyParentReady()
            }
        }, 8000)

        return () => {
            clearInterval(requestTimer)
            clearTimeout(readinessTimer)
            window.removeEventListener('message', handleMessage)
        }
    }, [])

    return <div className="h-full w-full" style={{ height: '100vh', width: '100vw', overflow: 'hidden' }} />
}
