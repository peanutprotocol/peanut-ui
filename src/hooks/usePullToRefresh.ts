import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { isCapacitor } from '@/utils/capacitor'
import { impactHaptic, notifyHaptic } from '@/utils/haptics'

// pull-to-refresh configuration constants
const DIST_MAX = 120 // maximum pull distance (visual limit)
const DIST_RELOAD = 80 // distance at which refresh is triggered when released
const PULL_DAMPING = 0.5
const AXIS_LOCK_SLOP_PX = 10
const INDICATOR_HIDDEN_Y = -48
const MIN_SPIN_MS = 600
const SUCCESS_HOLD_MS = 550 // how long the checkmark stays up before retracting
const RETRACT_MS = 220 // matches the indicator's transform transition
const CHECK_POP_MS = 260
const CONTENT_SETTLE_MS = 340
const DEFAULT_REFRESH_TARGET = '#scrollable-content'

const IDLE_BG = '#ffffff'
const SUCCESS_BG = '#98E9AB' // green-1

const SVG_OPEN =
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#000" ' +
    'stroke-linecap="round" stroke-linejoin="round"'
const ARROW_ICON = `${SVG_OPEN} stroke-width="2.5"><path d="M12 5v14M5 12l7 7 7-7"/></svg>`
// r=9 → circumference ~56.5, so a 24-long dash is a ~150deg arc over the track
const SPINNER_ICON =
    `${SVG_OPEN} stroke-width="2.5"><circle cx="12" cy="12" r="9" stroke-opacity="0.15"/>` +
    '<circle cx="12" cy="12" r="9" stroke-dasharray="24 33"/></svg>'
const CHECK_ICON = `${SVG_OPEN} stroke-width="3"><path d="M5 13l4 4L19 7"/></svg>`

interface UsePullToRefreshOptions {
    // custom function to determine if pull-to-refresh should be enabled
    // defaults to checking if window is at the top
    shouldPullToRefresh?: () => boolean
    // whether to enable pull-to-refresh (defaults to true)
    enabled?: boolean
    // element that gets the "content settled" fade once the refetch lands
    refreshTargetSelector?: string
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
 *
 * On native the refresh is a react-query invalidation, NOT a page reload
 * (window.location.reload() breaks the static export's SPA fallback), so the
 * screen never blinks and the gesture can feel like it did nothing. The
 * feedback below is what tells the user it happened:
 *   pulling   → the arrow rotates toward "release to refresh" and flips at the
 *               threshold, with a light haptic on the crossing
 *   refreshing→ spinner, held for MIN_SPIN_MS so a cache-warm refetch is still
 *               legible
 *   done      → green checkmark + success haptic, and the content fades back
 *               in so the screen visibly re-renders
 */
export const usePullToRefresh = (options: UsePullToRefreshOptions = {}) => {
    const { shouldPullToRefresh, enabled = true, refreshTargetSelector = DEFAULT_REFRESH_TARGET } = options
    const queryClient = useQueryClient()

    // store in refs so listener registration survives re-renders
    const shouldPullToRefreshRef = useRef(shouldPullToRefresh)
    const queryClientRef = useRef(queryClient)
    const refreshTargetRef = useRef(refreshTargetSelector)

    useEffect(() => {
        shouldPullToRefreshRef.current = shouldPullToRefresh
    }, [shouldPullToRefresh])

    useEffect(() => {
        queryClientRef.current = queryClient
    }, [queryClient])

    useEffect(() => {
        refreshTargetRef.current = refreshTargetSelector
    }, [refreshTargetSelector])

    useEffect(() => {
        if (typeof window === 'undefined' || !enabled) return

        const indicator = document.createElement('div')
        indicator.setAttribute('aria-hidden', 'true')
        indicator.style.cssText =
            'position:fixed;top:0;left:50%;z-index:1000;width:40px;height:40px;margin-left:-20px;' +
            `border-radius:50%;background:${IDLE_BG};border:2px solid #000;box-shadow:2px 2px 0 #000;` +
            'display:flex;align-items:center;justify-content:center;pointer-events:none;' +
            `transform:translateY(${INDICATOR_HIDDEN_Y}px);opacity:0;will-change:transform,opacity`

        // the icon lives in its own wrapper so the arrow's rotation (and the
        // spinner animation) compose with the indicator's translate/scale
        const icon = document.createElement('div')
        icon.style.cssText =
            'display:flex;align-items:center;justify-content:center;width:18px;height:18px;will-change:transform'
        icon.innerHTML = ARROW_ICON
        indicator.appendChild(icon)
        document.body.appendChild(indicator)

        let pulling = false
        let refreshing = false
        let armed = false
        let startX = 0
        let startY = 0
        let pullDistance = 0
        let axisLock: 'x' | 'y' | null = null
        let spinAnimation: Animation | null = null
        const timers: ReturnType<typeof setTimeout>[] = []

        // Element.animate is missing in jsdom and in older WebViews — the
        // indicator must still work without it, just without the flourish
        const animate = (element: Element, keyframes: Keyframe[], animationOptions: KeyframeAnimationOptions) =>
            typeof element.animate === 'function' ? element.animate(keyframes, animationOptions) : null

        const prefersReducedMotion = () =>
            typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

        const setIndicator = (pull: number, withTransition: boolean) => {
            indicator.style.transition = withTransition
                ? 'transform 0.2s ease, opacity 0.2s ease, background-color 0.2s ease'
                : 'background-color 0.2s ease'
            const progress = Math.min(pull / DIST_RELOAD, 1)
            const y = Math.min(pull, DIST_MAX) + INDICATOR_HIDDEN_Y
            // the indicator grows into place as the gesture approaches the threshold
            indicator.style.transform = `translateY(${y}px) scale(${0.6 + 0.4 * progress})`
            indicator.style.opacity = pull > 10 ? '1' : '0'
            // arrow points down at rest and is upright at the threshold — the
            // standard "release to refresh" affordance
            if (!refreshing) icon.style.transform = `rotate(${progress * 180}deg)`
        }

        const restoreIdleIndicator = () => {
            indicator.style.background = IDLE_BG
            icon.innerHTML = ARROW_ICON
            icon.style.transform = 'rotate(0deg)'
        }

        const resetPull = () => {
            pulling = false
            armed = false
            axisLock = null
            pullDistance = 0
            setIndicator(0, true)
        }

        const onTouchStart = (e: TouchEvent) => {
            if (refreshing || e.touches.length !== 1) return
            const allowed = shouldPullToRefreshRef.current ? shouldPullToRefreshRef.current() : window.scrollY === 0
            if (!allowed) return
            // a new pull can start inside the retract window — put the arrow back
            // now, so the previous run's checkmark doesn't get swapped mid-gesture
            restoreIdleIndicator()
            startX = e.touches[0].clientX
            startY = e.touches[0].clientY
            pulling = true
            armed = false
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
            // a tap on the threshold tells the user the release will do something,
            // before they let go — fired once per crossing, not per touchmove
            const nowArmed = pullDistance >= DIST_RELOAD
            if (nowArmed !== armed) {
                armed = nowArmed
                if (nowArmed) impactHaptic()
            }
        }

        // the refreshed screen fades back in — on native nothing else on screen
        // changes when the refetch resolves, so this is the "it reloaded" signal
        const settleContent = () => {
            if (prefersReducedMotion()) return
            const target = document.querySelector(refreshTargetRef.current)
            if (!target) return
            animate(target, [{ opacity: 0.35 }, { opacity: 1 }], { duration: CONTENT_SETTLE_MS, easing: 'ease-out' })
        }

        const finishRefresh = () => {
            spinAnimation?.cancel()
            spinAnimation = null
            icon.innerHTML = CHECK_ICON
            icon.style.transform = 'none'
            indicator.style.background = SUCCESS_BG
            animate(icon, [{ transform: 'scale(0.3)' }, { transform: 'scale(1.15)' }, { transform: 'scale(1)' }], {
                duration: CHECK_POP_MS,
                easing: 'ease-out',
            })
            notifyHaptic('success')
            settleContent()
            timers.push(
                setTimeout(() => {
                    refreshing = false
                    resetPull()
                    // swap back to the arrow only once the indicator is off-screen
                    timers.push(setTimeout(restoreIdleIndicator, RETRACT_MS))
                }, SUCCESS_HOLD_MS)
            )
        }

        const onTouchEnd = () => {
            if (!pulling || refreshing) return
            const triggered = pullDistance >= DIST_RELOAD
            if (!triggered) {
                resetPull()
                return
            }

            refreshing = true
            armed = false
            setIndicator(DIST_RELOAD, true)
            icon.innerHTML = SPINNER_ICON
            icon.style.transform = 'none'
            spinAnimation = animate(icon, [{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }], {
                duration: 800,
                iterations: Infinity,
            })

            if (isCapacitor()) {
                // in native app, invalidate queries to refetch the visible screen's
                // data without a page reload — window.location.reload() causes SPA
                // fallback issues in static export
                const startedAt = Date.now()
                Promise.resolve(queryClientRef.current.invalidateQueries())
                    .catch(() => {})
                    .then(() => {
                        const remaining = Math.max(0, MIN_SPIN_MS - (Date.now() - startedAt))
                        timers.push(setTimeout(finishRefresh, remaining))
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
            timers.forEach(clearTimeout)
            spinAnimation?.cancel()
            indicator.remove()
        }
    }, [enabled])
}
