'use client'

import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { screenTemplate } from '@/utils/performance-analytics'
import { usePathname } from 'next/navigation'
import { parseAsString, useQueryStates } from 'nuqs'
import posthog from 'posthog-js'
import { useEffect, useRef } from 'react'

type TransitionTrigger = 'link' | 'interaction' | 'programmatic' | 'history'

interface PendingTransition {
    fromScreen: string
    toScreen: string
    startedAt: number
    trigger: TransitionTrigger
}

const LINK_TRANSITION_TIMEOUT_MS = 10_000

const now = () => globalThis.performance?.now?.() ?? Date.now()

function screenFromUrl(value: string | URL | null | undefined): string | null {
    if (value == null) return null
    try {
        const url = new URL(String(value), window.location.href)
        if (url.origin !== window.location.origin) return null
        return screenTemplate(url.pathname, url.search)
    } catch {
        return null
    }
}

/**
 * Measures SPA navigation from intent/history mutation until two animation
 * frames after the destination commits. This is a route-shell metric, not a
 * claim that every async widget has finished loading.
 */
export function ScreenTransitionTracker() {
    const pathname = usePathname()
    const [query] = useQueryStates({
        drawer: parseAsString,
        method: parseAsString,
        country: parseAsString,
        view: parseAsString,
        recipient: parseAsString,
        username: parseAsString,
        id: parseAsString,
    })
    const trackedSearch = new URLSearchParams()
    Object.entries(query).forEach(([key, value]) => {
        if (value !== null) trackedSearch.set(key, value)
    })
    const screen = screenTemplate(pathname, trackedSearch.toString())
    const previousScreenRef = useRef<string | null>(null)
    const pendingRef = useRef<PendingTransition | null>(null)
    const interactionRef = useRef<{ fromScreen: string; startedAt: number } | null>(null)
    const pendingExpiryRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    useEffect(() => {
        const clearPendingExpiry = () => {
            if (pendingExpiryRef.current !== null) {
                clearTimeout(pendingExpiryRef.current)
                pendingExpiryRef.current = null
            }
        }

        const begin = (toScreen: string | null, trigger: TransitionTrigger): PendingTransition | null => {
            const fromScreen = screenTemplate(window.location.pathname, window.location.search)
            if (!toScreen || toScreen === fromScreen) return null

            // A link/pointer start is earlier and more representative than the
            // History API call Next makes later for the same transition.
            const pending = pendingRef.current
            if (pending?.fromScreen === fromScreen && pending.toScreen === toScreen) return pending
            const interaction = trigger === 'programmatic' ? interactionRef.current : null
            const usesRecentInteraction =
                interaction?.fromScreen === fromScreen && now() - interaction.startedAt < 15_000
            clearPendingExpiry()
            const nextPending: PendingTransition = {
                fromScreen,
                toScreen,
                startedAt: usesRecentInteraction ? interaction.startedAt : now(),
                trigger: usesRecentInteraction ? 'interaction' : trigger,
            }
            pendingRef.current = nextPending
            interactionRef.current = null

            // A link can be canceled or fail to navigate without ever
            // mutating history. Next.js Link also calls preventDefault() for a
            // successful SPA navigation, so expiry—not defaultPrevented—is the
            // safe way to discard an intent that never commits.
            if (trigger === 'link') {
                pendingExpiryRef.current = setTimeout(() => {
                    if (pendingRef.current === nextPending) pendingRef.current = null
                    pendingExpiryRef.current = null
                }, LINK_TRANSITION_TIMEOUT_MS)
            }

            return nextPending
        }

        const onClickCapture = (event: MouseEvent) => {
            const target = event.target instanceof Element ? event.target.closest('a[href]') : null
            if (target instanceof HTMLAnchorElement) {
                if (
                    event.button !== 0 ||
                    event.metaKey ||
                    event.ctrlKey ||
                    event.shiftKey ||
                    event.altKey ||
                    target.hasAttribute('download') ||
                    (target.target && target.target.toLowerCase() !== '_self')
                ) {
                    return
                }
                begin(screenFromUrl(target.href), 'link')
                return
            }

            // Most app navigation is a button calling router.push(). Next only
            // mutates history once that transition commits, so retain the
            // interaction start and attach its destination when pushState runs.
            const actionable = event.target instanceof Element ? event.target.closest('button,[role="button"]') : null
            if (actionable) {
                interactionRef.current = {
                    fromScreen: screenTemplate(window.location.pathname, window.location.search),
                    startedAt: now(),
                }
            }
        }

        const originalPushState = window.history.pushState
        const originalReplaceState = window.history.replaceState

        window.history.pushState = function (data, unused, url) {
            begin(screenFromUrl(url), 'programmatic')
            return originalPushState.call(this, data, unused, url)
        }
        window.history.replaceState = function (data, unused, url) {
            begin(screenFromUrl(url), 'programmatic')
            return originalReplaceState.call(this, data, unused, url)
        }
        const onPopState = () => {
            const fromScreen = previousScreenRef.current
            const toScreen = screenTemplate(window.location.pathname, window.location.search)
            if (fromScreen && fromScreen !== toScreen) {
                clearPendingExpiry()
                pendingRef.current = { fromScreen, toScreen, startedAt: now(), trigger: 'history' }
            }
        }

        document.addEventListener('click', onClickCapture, true)
        window.addEventListener('popstate', onPopState)
        return () => {
            document.removeEventListener('click', onClickCapture, true)
            window.removeEventListener('popstate', onPopState)
            window.history.pushState = originalPushState
            window.history.replaceState = originalReplaceState
            clearPendingExpiry()
        }
    }, [])

    useEffect(() => {
        const previousScreen = previousScreenRef.current
        previousScreenRef.current = screen
        if (previousScreen === null || previousScreen === screen) return

        const pending = pendingRef.current
        if (!pending || pending.toScreen !== screen) return

        let secondFrame = 0
        const firstFrame = requestAnimationFrame(() => {
            secondFrame = requestAnimationFrame(() => {
                if (pendingRef.current !== pending) return
                pendingRef.current = null
                if (pendingExpiryRef.current !== null) {
                    clearTimeout(pendingExpiryRef.current)
                    pendingExpiryRef.current = null
                }
                posthog.capture(ANALYTICS_EVENTS.SCREEN_TRANSITION_COMPLETED, {
                    from_screen: pending.fromScreen,
                    to_screen: screen,
                    duration_ms: Math.max(0, Math.round(now() - pending.startedAt)),
                    trigger: pending.trigger,
                    measurement: 'route_shell_double_raf',
                })
            })
        })

        return () => {
            cancelAnimationFrame(firstFrame)
            if (secondFrame) cancelAnimationFrame(secondFrame)
        }
    }, [screen])

    return null
}
