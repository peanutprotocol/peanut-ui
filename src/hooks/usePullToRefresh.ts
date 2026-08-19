import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { isCapacitor } from '@/utils/capacitor'

// pull-to-refresh configuration constants
const DIST_MAX = 120 // maximum pull distance (visual limit)
const DIST_RELOAD = 80 // distance at which refresh is triggered when released
const PULL_DAMPING = 0.5
const AXIS_LOCK_SLOP_PX = 10
const INDICATOR_HIDDEN_Y = -48
const MIN_SPIN_MS = 600

interface UsePullToRefreshOptions {
    // custom function to determine if pull-to-refresh should be enabled
    // defaults to checking if window is at the top
    shouldPullToRefresh?: () => boolean
    // whether to enable pull-to-refresh (defaults to true)
    enabled?: boolean
}

/**
 * Pull-to-refresh for mobile devices (native overscroll is disabled via
 * overscroll-behavior-y: none in globals.css).
 *
 * Hand-rolled with PASSIVE touch listeners: the previous pulltorefreshjs
 * implementation registered non-passive listeners on body, which forced every
 * touch in the app to round-trip the main thread before the compositor could
 * scroll — the classic Android-WebView scroll-jank pattern. Passive listeners
 * work here because a pull only happens at scrollY 0, where the gesture causes
 * no scrolling that would need preventDefault; the indicator animates with
 * compositor-only transform/opacity.
 */
export const usePullToRefresh = (options: UsePullToRefreshOptions = {}) => {
    const { shouldPullToRefresh, enabled = true } = options
    const queryClient = useQueryClient()

    // store in refs so listener registration survives re-renders
    const shouldPullToRefreshRef = useRef(shouldPullToRefresh)
    const queryClientRef = useRef(queryClient)

    useEffect(() => {
        shouldPullToRefreshRef.current = shouldPullToRefresh
    }, [shouldPullToRefresh])

    useEffect(() => {
        queryClientRef.current = queryClient
    }, [queryClient])

    useEffect(() => {
        if (typeof window === 'undefined' || !enabled) return

        const indicator = document.createElement('div')
        indicator.setAttribute('aria-hidden', 'true')
        indicator.style.cssText =
            'position:fixed;top:0;left:50%;z-index:1000;width:36px;height:36px;margin-left:-18px;' +
            'border-radius:50%;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,0.2);' +
            'display:flex;align-items:center;justify-content:center;pointer-events:none;' +
            `transform:translateY(${INDICATOR_HIDDEN_Y}px);opacity:0;will-change:transform`
        indicator.innerHTML =
            '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#666" stroke-width="2.5" ' +
            'stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12l7 7 7-7"/></svg>'
        document.body.appendChild(indicator)

        let pulling = false
        let refreshing = false
        let startX = 0
        let startY = 0
        let pullDistance = 0
        let axisLock: 'x' | 'y' | null = null
        let spinAnimation: Animation | null = null

        const setIndicator = (pull: number, animate: boolean) => {
            indicator.style.transition = animate ? 'transform 0.2s ease, opacity 0.2s ease' : 'none'
            const y = Math.min(pull, DIST_MAX) + INDICATOR_HIDDEN_Y
            indicator.style.transform = `translateY(${y}px)`
            indicator.style.opacity = pull > 10 ? '1' : '0'
        }

        const resetPull = () => {
            pulling = false
            axisLock = null
            pullDistance = 0
            setIndicator(0, true)
        }

        const onTouchStart = (e: TouchEvent) => {
            if (refreshing || e.touches.length !== 1) return
            const allowed = shouldPullToRefreshRef.current ? shouldPullToRefreshRef.current() : window.scrollY === 0
            if (!allowed) return
            startX = e.touches[0].clientX
            startY = e.touches[0].clientY
            pulling = true
            axisLock = null
            pullDistance = 0
        }

        const onTouchMove = (e: TouchEvent) => {
            if (!pulling || refreshing) return
            const dx = e.touches[0].clientX - startX
            const dy = e.touches[0].clientY - startY
            if (!axisLock && (Math.abs(dx) > AXIS_LOCK_SLOP_PX || Math.abs(dy) > AXIS_LOCK_SLOP_PX)) {
                axisLock = Math.abs(dy) >= Math.abs(dx) ? 'y' : 'x'
            }
            // don't hijack horizontal gestures (carousels) or real scrolls
            if (axisLock === 'x' || window.scrollY > 0) {
                resetPull()
                return
            }
            pullDistance = dy * PULL_DAMPING
            if (pullDistance > 0) setIndicator(pullDistance, false)
        }

        const finishRefresh = () => {
            spinAnimation?.cancel()
            spinAnimation = null
            refreshing = false
            resetPull()
        }

        const onTouchEnd = () => {
            if (!pulling || refreshing) return
            const triggered = pullDistance >= DIST_RELOAD
            if (!triggered) {
                resetPull()
                return
            }

            refreshing = true
            setIndicator(DIST_RELOAD, true)
            const svg = indicator.firstElementChild
            spinAnimation =
                svg?.animate([{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }], {
                    duration: 800,
                    iterations: Infinity,
                }) ?? null

            if (isCapacitor()) {
                // in native app, invalidate queries to refetch the visible screen's
                // data without a page reload — window.location.reload() causes SPA
                // fallback issues in static export
                const startedAt = Date.now()
                Promise.resolve(queryClientRef.current.invalidateQueries())
                    .catch(() => {})
                    .then(() => {
                        const remaining = Math.max(0, MIN_SPIN_MS - (Date.now() - startedAt))
                        setTimeout(finishRefresh, remaining)
                    })
            } else {
                window.location.reload()
            }
        }

        const listenerOptions: AddEventListenerOptions = { passive: true }
        document.addEventListener('touchstart', onTouchStart, listenerOptions)
        document.addEventListener('touchmove', onTouchMove, listenerOptions)
        document.addEventListener('touchend', onTouchEnd, listenerOptions)
        document.addEventListener('touchcancel', onTouchEnd, listenerOptions)

        return () => {
            document.removeEventListener('touchstart', onTouchStart)
            document.removeEventListener('touchmove', onTouchMove)
            document.removeEventListener('touchend', onTouchEnd)
            document.removeEventListener('touchcancel', onTouchEnd)
            spinAnimation?.cancel()
            indicator.remove()
        }
    }, [enabled])
}
