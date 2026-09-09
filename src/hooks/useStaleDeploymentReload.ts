'use client'

import { usePathname } from 'next/navigation'
import { useCallback, useContext, useEffect, useRef } from 'react'

import { DOCUMENT_CACHE_PATTERNS } from '@/constants/cache.consts'
import { loadingStateContext } from '@/context/loadingStates.context'
import { usePendingTransactions } from '@/hooks/wallet/usePendingTransactions'
import { useZerodevStore } from '@/redux/hooks'
import { isCapacitor } from '@/utils/capacitor'
import { isStandalonePwa, purgeCaches } from '@/utils/cache.utils'

/**
 * Reloads a document left running on a superseded deployment.
 *
 * Nothing else in the app does this. The service worker's `controllerchange`
 * reload is skipped in standalone PWA (an Android standalone session can bounce
 * out to Chrome — see the sw-registration script in layout.tsx), App Router
 * navigations fetch RSC payloads rather than documents, and chunk-error
 * recovery only fires once an asset actually 404s. So a loaded document can
 * outlive arbitrarily many deploys, keeping its original JS, its API
 * assumptions, and its response headers. That is how weeks-old
 * Content-Security-Policy-Report-Only headers kept reporting violations against
 * an allow-list that had already been fixed.
 *
 * Reload timing is deliberately conservative: a forced reload mid-flow can
 * destroy state that only lives in component memory (a Sumsub WebSDK session,
 * a half-filled card application) or leave the user unsure whether a payment
 * went through. So staleness is latched on detection and acted on only at a
 * safe boundary — tab re-focus or a route change — with no money flow running.
 */

const VERSION_ENDPOINT = '/api/version'

// Read inside a function rather than at module scope: Next inlines
// NEXT_PUBLIC_* wherever it appears, so this is still a build-time constant in
// the bundle, but tests can set it without a second module registry.
const buildCommit = () => process.env.NEXT_PUBLIC_GIT_COMMIT_HASH

const CHECK_THROTTLE_MS = 5 * 60_000
const RELOAD_GUARD_MS = 5 * 60_000

// A tab that is never backgrounded and never navigated would otherwise only
// ever check once, at mount — and that is precisely the shape of the sessions
// that stayed on a superseded deployment for days. One small request per open
// tab per half hour is the cost of catching them.
const POLL_INTERVAL_MS = 30 * 60_000

const RELOAD_AT_KEY = 'peanut-stale-deploy-reload-at'
const RELOAD_ATTEMPTED_KEY = 'peanut-stale-deploy-attempted'

/*
 * Native has no deployment to be stale against — it serves local files and
 * updates through Capgo OTA. What it has instead is a document that never
 * ends: the service worker's controllerchange reload is skipped, no
 * navigation replaces the document (the static export routes on query params
 * alone), and the OS keeps the WebView alive for days. So everything the
 * document accumulates accumulates for that entire time, and — worse — any
 * module-level promise that wedges stays wedged: that is why a Crisp helper
 * that never settled meant no support chat until the user force-quit, and why
 * one failed confetti burst meant no celebrations ever again.
 *
 * Bound the document's lifetime instead of the deployment's. Twelve hours
 * means at most one reload a day, taken on a resume, which is a boundary the
 * user already experiences as the app coming back.
 */
const MAX_NATIVE_DOCUMENT_AGE_MS = 12 * 60 * 60_000

// performance.now() is milliseconds since this document's timeOrigin, so it
// resets to zero on exactly the event we are trying to cause — no bookkeeping,
// and no way for the age check to survive the reload it triggers.
function documentAgeMs(): number {
    return typeof performance === 'undefined' ? 0 : performance.now()
}

/**
 * Routes whose in-progress state lives in component memory and cannot survive a
 * reload: the Sumsub WebSDK session and the card application's pending terms /
 * country confirmation, the withdraw legs, passkey registration, and the onramp
 * deposit flows. Matched per path segment so locale-prefixed paths (`/en/card`)
 * are covered too.
 */
const RELOAD_UNSAFE_SEGMENTS = new Set(['card', 'withdraw', 'setup', 'add-money', 'kyc'])

function hasUnsafeSegment(pathname: string): boolean {
    return pathname.split('/').some((segment) => RELOAD_UNSAFE_SEGMENTS.has(segment))
}

function readSessionFlag(key: string): string | null {
    try {
        return sessionStorage.getItem(key)
    } catch {
        return null
    }
}

export function useStaleDeploymentReload() {
    const pathname = usePathname()
    const { hasPendingTransactions } = usePendingTransactions()
    const { isSendingUserOp } = useZerodevStore()
    const { isLoading } = useContext(loadingStateContext)

    const isStaleRef = useRef(false)
    const isDisabledRef = useRef(false)
    const lastCheckedAtRef = useRef(0)

    // Event listeners are registered once; without this the closure would keep
    // reading the gate values from its first render.
    const isSafeRef = useRef(true)
    isSafeRef.current = !hasPendingTransactions && !isSendingUserOp && !isLoading && !hasUnsafeSegment(pathname)

    // replace() rather than reload() in standalone: it leaves no history entry,
    // which is the form least likely to bounce an Android PWA session out to
    // the browser.
    const reloadDocument = useCallback(() => {
        if (isStandalonePwa()) window.location.replace(window.location.href)
        else window.location.reload()
    }, [])

    const reloadIfStaleAndSafe = useCallback(() => {
        if (isDisabledRef.current || !isStaleRef.current || !isSafeRef.current) return

        // A reload that does not clear the mismatch would otherwise repeat
        // forever. One attempt per session; if we come back still stale, the
        // reload is not the fix and this hook stands down.
        if (readSessionFlag(RELOAD_ATTEMPTED_KEY)) {
            isDisabledRef.current = true
            return
        }
        const lastReloadAt = Number(readSessionFlag(RELOAD_AT_KEY) || 0)
        if (Date.now() - lastReloadAt < RELOAD_GUARD_MS) return

        try {
            sessionStorage.setItem(RELOAD_AT_KEY, String(Date.now()))
            sessionStorage.setItem(RELOAD_ATTEMPTED_KEY, '1')
        } catch {
            // no sessionStorage -> no loop protection -> don't auto-reload
            return
        }

        isDisabledRef.current = true
        void purgeCaches(DOCUMENT_CACHE_PATTERNS).then(reloadDocument)
    }, [reloadDocument])

    /*
     * The native counterpart. Deliberately does NOT set RELOAD_ATTEMPTED_KEY:
     * that latch exists because a reload cannot fix a deployment mismatch the
     * server keeps serving, whereas a reload always fixes document age. It also
     * skips purgeCaches — those are the web service worker's Workbox caches,
     * and the native export is served locally, so there is nothing there worth
     * deleting and a stale SW still in the WebView is better left alone.
     */
    const reloadIfDocumentIsOld = useCallback(() => {
        if (isDisabledRef.current || !isSafeRef.current) return
        if (documentAgeMs() < MAX_NATIVE_DOCUMENT_AGE_MS) return

        const lastReloadAt = Number(readSessionFlag(RELOAD_AT_KEY) || 0)
        if (Date.now() - lastReloadAt < RELOAD_GUARD_MS) return

        try {
            sessionStorage.setItem(RELOAD_AT_KEY, String(Date.now()))
        } catch {
            // no sessionStorage -> no loop protection -> don't auto-reload
            return
        }

        isDisabledRef.current = true
        reloadDocument()
    }, [reloadDocument])

    const checkVersion = useCallback(async () => {
        if (isDisabledRef.current || isStaleRef.current || !buildCommit()) return
        if (Date.now() - lastCheckedAtRef.current < CHECK_THROTTLE_MS) return
        lastCheckedAtRef.current = Date.now()

        try {
            const response = await fetch(VERSION_ENDPOINT, { cache: 'no-store' })
            if (!response.ok) return
            const { commit } = (await response.json()) as { commit?: string }
            if (!commit || commit === 'unknown') return

            if (commit === buildCommit()) {
                // Current again — clear the one-attempt latch so a later deploy
                // can still trigger a reload in this session.
                try {
                    sessionStorage.removeItem(RELOAD_ATTEMPTED_KEY)
                } catch {}
                return
            }
            isStaleRef.current = true
        } catch {
            // offline or the route is unreachable -> try again next re-focus
        }
    }, [])

    useEffect(() => {
        // Native builds serve local files and update through Capgo OTA, so
        // there is no deployment to be stale against.
        if (isCapacitor()) return

        const checkNow = () => {
            void checkVersion().then(reloadIfStaleAndSafe)
        }
        const onVisible = () => {
            if (document.visibilityState === 'visible') checkNow()
        }
        const onPoll = () => {
            if (document.visibilityState === 'visible') checkNow()
        }

        // Worth checking even on a fresh mount: a document served back out of
        // the service worker's NetworkFirst cache is already stale on arrival.
        checkNow()
        document.addEventListener('visibilitychange', onVisible)
        const pollId = setInterval(onPoll, POLL_INTERVAL_MS)
        return () => {
            document.removeEventListener('visibilitychange', onVisible)
            clearInterval(pollId)
        }
    }, [checkVersion, reloadIfStaleAndSafe])

    // Native: the resume is the boundary. A document old enough to be worth
    // replacing is one the user has already left and come back to, so the
    // reload lands where they expect the app to be starting anyway.
    useEffect(() => {
        if (!isCapacitor()) return

        let disposed = false
        let removeListener: (() => void) | undefined

        import('@capacitor/app')
            .then(({ App }) =>
                App.addListener('appStateChange', ({ isActive }) => {
                    if (isActive) reloadIfDocumentIsOld()
                })
            )
            .then((handle) => {
                if (disposed) void handle.remove()
                else removeListener = () => void handle.remove()
            })
            .catch(() => {
                // no app plugin -> the route-change boundary below still applies
            })

        return () => {
            disposed = true
            removeListener?.()
        }
    }, [reloadIfDocumentIsOld])

    // The other safe boundaries: a route change, or a money flow finishing and
    // reopening the gate. No fetch here — this only acts on staleness a
    // previous check already latched, or on an age already reached.
    useEffect(() => {
        if (isCapacitor()) {
            reloadIfDocumentIsOld()
            return
        }
        reloadIfStaleAndSafe()
    }, [pathname, hasPendingTransactions, isSendingUserOp, isLoading, reloadIfStaleAndSafe, reloadIfDocumentIsOld])
}
