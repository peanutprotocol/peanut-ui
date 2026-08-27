'use client'

import { Icon } from '@/components/Global/Icons/Icon'
import IndicatorDot from '@/components/Global/IndicatorDot'
import underMaintenanceConfig from '@/config/underMaintenance.config'
import { isSameRoute } from '@/constants/routes'
import { useModalsContext } from '@/context/ModalsContext'
import { useSupportUnread } from '@/hooks/useSupportUnread'
import { motion, useReducedMotion } from 'framer-motion'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useAppHaptic } from '@/hooks/useAppHaptic'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'

/**
 * Bottom navigation from the figma navigation board (17802:61534, component
 * 17317:138477): a pill bar with home / card / support tabs plus the pink QR
 * circle button. Active tab = white pill. Every pressable area is 68x52px
 * (24px/16px padding around a 20px icon) — over the 44px touch-target floor.
 *
 * The active pill is ONE element that lives in the bar for the whole session
 * and moves by transform. It is drawn 1px wider and 2px taller than its tab,
 * so its border sits ON TOP of the bar's border and reads as a complete
 * outline (board 17802:61534). At the old -inset-px the two 1px borders
 * landed on exactly the same row in the same color, which read as the pill's
 * border being clipped by the bar edge.
 *
 * Why a measured transform and not framer's `layoutId`:
 * the pill used to be re-mounted inside whichever tab was active, and framer
 * animated the gap with a shared-layout projection. A projection reads the
 * target box AFTER the new tree paints, so the spring can begin against the
 * box framer had at mount time and get re-pointed mid-flight when the real
 * box arrives — one motion, two targets. That matches the report we got
 * (reading the tabs as positions 1 / 10 / 20: 1 -> 10 lands near 9 and then
 * creeps to 10, 10 -> 1 overshoots to about 2 and creeps back).
 *
 * Caveat worth keeping honest: that report never reproduced in the harness,
 * on the old code either, even under 6x CPU throttling. So this is not a
 * measured before/after — it removes the mechanism that can produce the
 * described behavior, rather than a defect anyone captured.
 *
 * Now every tab's left/width is measured up front (and again on resize), so
 * the destination x is a number known BEFORE the spring starts. Nothing is
 * re-measured mid-flight, so the pill travels once and stops on the target.
 * The spring is near-critically damped (bounce 0.05 over the 300ms moderate
 * token) — no overshoot to walk back from.
 *
 * The pill is also draggable (drag="x", clamped to the measured tab range):
 * hold and drag it along the bar, release, and it snaps to the nearest tab
 * and navigates there. Taps keep working — a click right after a drag is
 * swallowed by the bar's capture handler. Under prefers-reduced-motion the
 * drag is disabled (taps only) and the pill move is instant.
 */

type TabId = 'home' | 'card' | 'support'

const TAB_ORDER: TabId[] = ['home', 'card', 'support']

// tab pressable: px-6 py-4 + 20px icon = the 68x52 area annotated on the board
const tabClass =
    'relative flex items-center justify-center rounded-round px-6 py-4 text-foreground-primary transition-colors duration-instant focus-visible:outline-[3px] focus-visible:outline-action-focus'

// icons sit above the pill (z) and let pointer events fall through to the
// tab / draggable pill underneath
const iconClass = 'pointer-events-none relative z-10'

// near-critically damped: the pill lands on the measured target without an
// overshoot to walk back from. 0.3s = the `duration-moderate` motion token.
const PILL_SPRING = { type: 'spring', duration: 0.3, bounce: 0.05 } as const

/** A tab's box inside the bar, in the bar's own coordinates. */
type TabBox = { left: number; width: number }

// the pill is 1px wider on each side than its tab (see the block comment), so
// its resting x is the tab's left minus that 1px
const restingX = (box: TabBox) => box.left - 1

export const BottomNav = () => {
    const t = useTranslations('navigation')
    const pathname = usePathname()
    const router = useRouter()
    const { isSupportModalOpen, setIsSupportModalOpen, setIsQRScannerOpen } = useModalsContext()
    const { triggerHaptic } = useAppHaptic()
    const hasUnreadSupport = useSupportUnread()
    const reduceMotion = useReducedMotion()

    const barRef = useRef<HTMLDivElement>(null)
    const tabRefs = useRef<Partial<Record<TabId, HTMLElement | null>>>({})
    // set while a pill drag is in flight so the click the browser fires on
    // release doesn't ALSO trigger the tab underneath
    const didDragRef = useRef(false)

    // Every tab's box, measured once and again on any bar resize. This is the
    // whole fix: the destination is a number before the spring starts.
    const [boxes, setBoxes] = useState<Partial<Record<TabId, TabBox>>>({})

    useLayoutEffect(() => {
        const measure = () => {
            setBoxes((prev) => {
                const next: Partial<Record<TabId, TabBox>> = {}
                for (const id of TAB_ORDER) {
                    const el = tabRefs.current[id]
                    // offsetLeft is relative to the bar (the nearest positioned
                    // ancestor), which is the coordinate space the pill uses
                    if (el) next[id] = { left: el.offsetLeft, width: el.offsetWidth }
                }
                // bail on an identical result so the ResizeObserver cannot
                // drive a render loop through this state
                const same = TAB_ORDER.every(
                    (id) => prev[id]?.left === next[id]?.left && prev[id]?.width === next[id]?.width
                )
                return same ? prev : next
            })
        }
        measure()
        const bar = barRef.current
        if (!bar || typeof ResizeObserver === 'undefined') return
        const observer = new ResizeObserver(measure)
        observer.observe(bar)
        return () => observer.disconnect()
    }, [])

    // one active tab at a time so the shared pill has a single home
    const routeTab: TabId | null =
        isSupportModalOpen || isSameRoute(pathname, '/support')
            ? 'support'
            : (pathname?.startsWith('/card') ?? false)
              ? 'card'
              : isSameRoute(pathname, '/home')
                ? 'home'
                : null

    // Start the slide AFTER the route commit, not during it.
    //
    // Measured on a prod build, sampling the pill every frame: tapping a tab
    // blocked the main thread for 45.6ms while React committed the new route.
    // The spring's first step therefore integrated ~46ms of elapsed time at
    // once and the pill teleported 21px before settling into a normal 8ms
    // cadence — the "beginning teleports" report. Spring parameters cannot fix
    // that; the frame budget was simply gone.
    //
    // Two rAFs after the commit the main thread is free again, so the spring
    // starts from rest on a clean frame and every step is even. The cost is
    // ~16-32ms before the pill starts moving, which is below the threshold
    // where a delay reads as lag.
    const [activeTab, setActiveTab] = useState<TabId | null>(routeTab)
    useEffect(() => {
        if (routeTab === activeTab) return
        let inner = 0
        const outer = requestAnimationFrame(() => {
            inner = requestAnimationFrame(() => setActiveTab(routeTab))
        })
        return () => {
            cancelAnimationFrame(outer)
            cancelAnimationFrame(inner)
        }
    }, [routeTab, activeTab])

    const activateTab = (tab: TabId) => {
        if (tab === 'support') setIsSupportModalOpen(true)
        else router.push(tab === 'home' ? '/home' : '/card')
    }

    const handleDragEnd = (event: PointerEvent | MouseEvent | TouchEvent) => {
        // release the click-suppression only after the post-drag click has fired
        setTimeout(() => {
            didDragRef.current = false
        }, 0)
        const clientX = 'clientX' in event ? event.clientX : (event.changedTouches?.[0]?.clientX ?? Number.NaN)
        if (Number.isNaN(clientX)) return
        // snap to the tab whose center is nearest the release point
        let nearest: TabId | null = null
        let best = Number.POSITIVE_INFINITY
        for (const id of TAB_ORDER) {
            const el = tabRefs.current[id]
            if (!el) continue
            const rect = el.getBoundingClientRect()
            const distance = Math.abs(clientX - (rect.left + rect.width / 2))
            if (distance < best) {
                best = distance
                nearest = id
            }
        }
        // same tab: dragSnapToOrigin springs the pill back on its own
        if (nearest && nearest !== activeTab) {
            triggerHaptic()
            // Retarget the pill in the same tick as the release, ahead of the
            // route. The two-rAF deferral below is there for TAPS, where the
            // route commit eats the frame budget; applying it to a drag would
            // let dragSnapToOrigin pull the pill back to the tab it came from
            // for ~80ms before it turned around.
            setActiveTab(nearest)
            activateTab(nearest)
        }
    }

    const activeBox = activeTab ? boxes[activeTab] : undefined
    // the drag range is the first and last tab's resting x. Numeric bounds
    // rather than `dragConstraints={barRef}`: the pill is 1px wider than a tab
    // on each side, so a bar-sized box clamps it 1px short at both ends.
    const dragBounds = {
        left: boxes[TAB_ORDER[0]] ? restingX(boxes[TAB_ORDER[0]]!) : 0,
        right: boxes[TAB_ORDER[TAB_ORDER.length - 1]] ? restingX(boxes[TAB_ORDER[TAB_ORDER.length - 1]]!) : 0,
    }

    return (
        // px-4 gutter (L/16): deliberate divergence from the board's px-6 —
        // rulings 17+18 want the bar spanning the viewport on mobile with a
        // minimal edge inset (AppShell's max-w-md wrapper keeps desktop sane)
        <nav className="flex w-full items-center gap-4 px-4 py-2" translate="no">
            <div
                ref={barRef}
                onClickCapture={(e) => {
                    if (didDragRef.current) {
                        e.preventDefault()
                        e.stopPropagation()
                    }
                }}
                // solid bar, no shadow — the AppShell nav wrapper carries a
                // bottom-to-top background-page fade instead (ruled 2026-08-27)
                className="relative flex flex-1 items-center justify-between rounded-round border border-border-default bg-background-page"
            >
                <Link
                    href="/home"
                    draggable={false}
                    aria-label={t('home')}
                    onClick={() => triggerHaptic()}
                    className={tabClass}
                    ref={(el) => {
                        tabRefs.current.home = el
                    }}
                >
                    <Icon name="home" size={20} className={iconClass} />
                </Link>
                <Link
                    href="/card"
                    draggable={false}
                    aria-label={t('card')}
                    onClick={() => triggerHaptic()}
                    className={tabClass}
                    ref={(el) => {
                        tabRefs.current.card = el
                    }}
                >
                    <Icon name="credit-card" size={20} className={iconClass} />
                </Link>
                <button
                    type="button"
                    aria-label={t('support')}
                    onClick={() => {
                        triggerHaptic()
                        setIsSupportModalOpen(true)
                    }}
                    className={tabClass}
                    ref={(el) => {
                        tabRefs.current.support = el
                    }}
                >
                    <span className={iconClass}>
                        <Icon name="peanut-support" size={20} />
                        {/* role="status" so the dot is announced — aria-label alone on
                            a bare span is ignored by assistive tech (generic role). */}
                        {hasUnreadSupport && (
                            <IndicatorDot
                                className="absolute -top-1 -right-1"
                                role="status"
                                aria-label={t('supportUnread')}
                            />
                        )}
                    </span>
                </button>
                {/* Last in the bar so it paints over the tab boxes, but under
                    the icons (z-10, and the tabs make no stacking context of
                    their own). Icons are pointer-events-none, so a press over
                    the active tab reaches the pill and can start a drag.
                    Width is set, not animated: all three tabs are px-6 around
                    a 20px icon, so it never changes — animating it would cost
                    a layout pass per frame for nothing. */}
                {activeBox && (
                    <motion.span
                        aria-hidden
                        data-testid="bottom-nav-pill"
                        drag={reduceMotion ? false : 'x'}
                        dragConstraints={dragBounds}
                        dragElastic={0.05}
                        dragMomentum={false}
                        dragSnapToOrigin
                        onDragStart={() => {
                            didDragRef.current = true
                        }}
                        onDragEnd={(event) => handleDragEnd(event)}
                        // initial={false} adopts the target on mount, so the
                        // pill appears already on its tab instead of sliding
                        // in from the left on the first paint.
                        initial={false}
                        animate={{ x: restingX(activeBox), width: activeBox.width + 2 }}
                        transition={reduceMotion ? { duration: 0 } : PILL_SPRING}
                        className="absolute -top-0.5 -bottom-0.5 left-0 z-0 touch-none rounded-round border border-border-default bg-background-default"
                    />
                )}
            </div>
            {/* 52px pink QR circle (board NavigationButton state=Primary) */}
            <button
                type="button"
                aria-label={t('scanQr')}
                disabled={underMaintenanceConfig.enableFullMaintenance}
                onClick={() => {
                    triggerHaptic()
                    setIsQRScannerOpen(true)
                }}
                className="flex size-13 shrink-0 items-center justify-center rounded-round border border-border-button bg-action-primary text-foreground-primary transition-transform duration-instant active:scale-95 disabled:opacity-40"
            >
                <Icon name="qr-code" size={24} />
            </button>
        </nav>
    )
}
