'use client'

import { useCallback, useEffect, useState } from 'react'
import { startHostedVerification } from '@/app/actions/sumsub'
import { useAuth } from '@/context/authContext'
import { isNativeBridge, openExternalUrl } from '@/utils/capacitor'

/**
 * Drives the handoff to a provider's hosted verification page and the wait for
 * the user to come back from it. Serves both `bridge-hosted` (Bridge/Persona)
 * and `rain-hosted` (Rain's card-member portal) — the same top-level-tab
 * handoff applies to any third-party page that can't be iframed.
 *
 * `start` must be called STRAIGHT out of a click handler — it reserves the tab
 * synchronously, inside the user-activation window (see below).
 */
interface HostedVerification {
    /** Call STRAIGHT out of a click — the tab reservation needs the gesture. */
    start: () => Promise<void>
    isStarting: boolean
    /** Friendly copy for a failed launch; never the raw server detail. */
    error: string | null
}

export function useHostedVerification(
    actionKey: 'bridge-hosted' | 'rain-hosted' = 'bridge-hosted'
): HostedVerification {
    const { fetchUser } = useAuth()
    const [isStarting, setIsStarting] = useState(false)
    const [awaitingReturn, setAwaitingReturn] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const start = useCallback(async () => {
        setError(null)
        // NOT an iframe: `bridge.withpersona.com` serves
        // `X-Frame-Options: SAMEORIGIN`, so embedding it rendered
        // "refused to connect" for EVERY user. It has to be a real
        // top-level page (native: the in-app browser). Bridge's ToS link
        // (`compliance.bridge.xyz`) sends no framing header, which is why
        // BridgeTosStep keeps its iframe.
        //
        // On web, reserve the tab HERE — synchronously, inside the click's
        // user-activation window. Fetching the link takes ~800ms, and a
        // window.open() after that await is no longer gesture-initiated,
        // so Safari/Firefox block it — the same "nothing happens" symptom
        // this PR exists to fix. The reserved tab is navigated once the
        // URL lands, and closed if it never does.
        // isNativeBridge(), not isCapacitor(): the latter is also true for
        // any build carrying NEXT_PUBLIC_CAPACITOR_BUILD (vercel previews),
        // where the native apis don't exist and we'd skip the reservation
        // in a real browser.
        const native = isNativeBridge()
        const reservedTab = native ? null : window.open('', '_blank')
        // The reserved tab can't carry `noopener` (that returns null and
        // defeats the reservation), so sever the back-reference by hand —
        // otherwise Persona, and anything it redirects to, holds a handle
        // that can navigate the signed-in tab (reverse tabnabbing).
        if (reservedTab) reservedTab.opener = null

        setIsStarting(true)
        let url: string | undefined
        try {
            ;({ url } = await startHostedVerification(actionKey))
        } catch (error) {
            // The action body catches its own errors, but a server action
            // can still REJECT at the transport layer — a dropped network,
            // or a deploy invalidating the action id mid-flight. Without
            // this the button stays on "Loading..." forever and the blank
            // reserved tab is orphaned.
            reservedTab?.close()
            console.error(`[hosted:${actionKey}] start-action rejected`, error)
            setError("We couldn't start the verification. Please try again in a moment.")
            return
        } finally {
            setIsStarting(false)
        }
        if (!url) {
            // Friendly copy regardless of the server detail (a 403 here just
            // means the action aged out); refetch so a stale entry point
            // self-corrects.
            reservedTab?.close()
            setError("We couldn't start the verification. Please try again in a moment.")
            void fetchUser().catch(() => undefined)
            return
        }
        try {
            if (native) {
                await openExternalUrl(url)
            } else if (reservedTab && !reservedTab.closed) {
                // `.closed` matters: assigning href to a closed window is a
                // silent no-op, so without this the user would tap and see
                // nothing — the very failure this PR removes.
                reservedTab.location.href = url
            } else {
                // No usable tab: pop-ups blocked, a standalone PWA, or the
                // user closed the blank tab while we fetched. Same-tab
                // navigation is never gesture-gated, so it always lands.
                reservedTab?.close()
                window.location.href = url
                return
            }
        } catch (error) {
            reservedTab?.close()
            console.error(`[hosted:${actionKey}] failed to open hosted verification`, error)
            setError("We couldn't open the verification. Please try again in a moment.")
            return
        }
        setAwaitingReturn(true)
    }, [fetchUser, actionKey])

    // The same-tab fallback navigates THIS tab away, so the listener below is
    // never armed for it — and a Back that restores from BFCache re-runs no
    // effects at all. `refetchOnWindowFocus` does fire on that restore, but the
    // user query carries staleTime 5m (hooks/query/user.ts) and TanStack skips
    // it as fresh, so a user who just finished the check would still read as
    // having the task. `refetch` ignores staleness, which is the point.
    useEffect(() => {
        const onPageShow = (event: PageTransitionEvent) => {
            if (event.persisted) void fetchUser().catch(() => undefined)
        }
        window.addEventListener('pageshow', onPageShow)
        return () => window.removeEventListener('pageshow', onPageShow)
    }, [fetchUser])

    // Nothing polls for this cohort — the ~4s user auto-refresh only runs
    // while a rail is `pending`, and these are `requires-info` — so pick the
    // result up when the user comes back from the hosted flow.
    //
    // Deliberately NOT one-shot: the first return is often incidental (a quick
    // tab switch back, or Persona telling them to continue on their phone).
    // Burning the single refetch there would leave the screen stale forever,
    // so we keep listening for as long as this screen is mounted.
    useEffect(() => {
        if (!awaitingReturn) return
        const refresh = () => void fetchUser().catch(() => undefined)

        if (isNativeBridge()) {
            // Android WebViews don't reliably fire `visibilitychange` on
            // resume — the same defect that makes useNativePlugins drive
            // TanStack's focusManager off `appStateChange`. The in-app
            // browser's own close event is the precise signal here.
            let disposed = false
            let remove: (() => void) | undefined
            void import('@capacitor/browser')
                .then(({ Browser }) => Browser.addListener('browserFinished', refresh))
                .then((handle) => {
                    // Cleanup can run while the dynamic import is still in
                    // flight; without this the listener registers after the
                    // fact and nobody ever removes it.
                    if (disposed) handle.remove()
                    else remove = () => handle.remove()
                })
                .catch((error) => console.error(`[hosted:${actionKey}] browserFinished listener failed`, error))
            return () => {
                disposed = true
                remove?.()
            }
        }

        const onReturn = () => {
            if (document.visibilityState === 'visible') refresh()
        }
        document.addEventListener('visibilitychange', onReturn)
        return () => document.removeEventListener('visibilitychange', onReturn)
    }, [awaitingReturn, fetchUser, actionKey])

    return { start, isStarting, error }
}
