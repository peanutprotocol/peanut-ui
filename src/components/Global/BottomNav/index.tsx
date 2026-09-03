'use client'

import { Icon } from '@/components/Global/Icons/Icon'
import IndicatorDot from '@/components/Global/IndicatorDot'
import underMaintenanceConfig from '@/config/underMaintenance.config'
import { isSameRoute } from '@/constants/routes'
import { useModalsContext } from '@/context/ModalsContext'
import { useSupportUnread } from '@/hooks/useSupportUnread'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useAppHaptic } from '@/hooks/useAppHaptic'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { TAB_ORDER, type TabId } from './tab-order'

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
 * Ruled 2026-09-03 (kush, supersedes the framer-spring approach): the pill is
 * a CSS compositor transition on `transform`, retargeted ON TAP. Two reasons,
 * both native-feel:
 * - a JS-driven spring shares the main thread with the route commit, so the
 *   commit's long frame stuttered the motion (the old code even deferred the
 *   start by two rAFs to dodge it, which read as input lag instead). A CSS
 *   transform transition runs on the compositor and glides straight through
 *   the commit.
 * - native tab bars respond on touch, not after navigation settles — the
 *   pill now moves in the same tick as the tap, like the drag path used to.
 * The bezier overshoots a few percent: the ruled "little bounce", no jitter.
 *
 * Drag-the-pill survives the framer removal as manual pointer events: while
 * a finger holds the pill the transition is suspended and the transform
 * tracks the pointer 1:1 (clamped to the tab range); release snaps to the
 * nearest tab with the same transition and navigates. Support is an overlay,
 * so releasing on it opens the drawer and the pill glides home.
 */

// tab pressable: px-6 py-4 + 20px icon = the 68x52 area annotated on the board
const tabClass =
    'relative flex items-center justify-center rounded-round px-6 py-4 text-foreground-primary transition-colors duration-instant focus-visible:outline-[3px] focus-visible:outline-action-focus'

// icons sit above the pill (z) and let pointer events fall through
const iconClass = 'pointer-events-none relative z-10'

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

    const barRef = useRef<HTMLDivElement>(null)
    const tabRefs = useRef<Partial<Record<TabId, HTMLElement | null>>>({})
    const pillRef = useRef<HTMLSpanElement>(null)
    // live drag bookkeeping — refs, not state: the transform is written to the
    // DOM directly per move so the drag never waits on a render
    const dragRef = useRef<{ pointerId: number; startClientX: number; baseX: number; moved: boolean } | null>(null)

    // Every tab's box, measured once and again on any bar resize — the
    // destination x is a number known before the transition starts.
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

    // one active tab at a time so the shared pill has a single home. The pill
    // tracks the ROUTE only — the support drawer is an overlay, not
    // navigation, so opening it must not move the pill (it used to slide over
    // and spring back / vanish on close).
    const routeTab: TabId | null =
        (pathname?.startsWith('/card') ?? false) ? 'card' : isSameRoute(pathname, '/home') ? 'home' : null

    // Optimistic: taps retarget the pill in the same tick (the Link onClick
    // below), and this effect only reconciles EXTERNAL navigation — deep
    // links, hardware back, programmatic pushes.
    const [activeTab, setActiveTab] = useState<TabId | null>(routeTab)
    useEffect(() => {
        if (routeTab !== null && routeTab !== activeTab) setActiveTab(routeTab)
        // activeTab is deliberately read-only here: including it would undo an
        // optimistic tap on the render before the route commits
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [routeTab])

    const activeBox = activeTab ? boxes[activeTab] : undefined

    const clampX = (x: number) => {
        const first = boxes[TAB_ORDER[0]]
        const last = boxes[TAB_ORDER[TAB_ORDER.length - 1]]
        if (!first || !last) return x
        return Math.min(Math.max(x, restingX(first)), restingX(last))
    }

    const onPillPointerDown = (e: React.PointerEvent<HTMLSpanElement>) => {
        if (!activeBox || !pillRef.current) return
        pillRef.current.setPointerCapture(e.pointerId)
        dragRef.current = { pointerId: e.pointerId, startClientX: e.clientX, baseX: restingX(activeBox), moved: false }
        // the finger owns the transform now — the transition would lag it
        pillRef.current.style.transitionProperty = 'none'
    }

    const onPillPointerMove = (e: React.PointerEvent<HTMLSpanElement>) => {
        const drag = dragRef.current
        if (!drag || !pillRef.current || e.pointerId !== drag.pointerId) return
        const dx = e.clientX - drag.startClientX
        if (Math.abs(dx) > 4) drag.moved = true
        pillRef.current.style.transform = `translateX(${clampX(drag.baseX + dx)}px)`
    }

    const endPillDrag = (e: React.PointerEvent<HTMLSpanElement>, cancelled: boolean) => {
        const drag = dragRef.current
        if (!drag || !pillRef.current || e.pointerId !== drag.pointerId) return
        dragRef.current = null
        // hand the transform back to the transition before the snap target lands
        pillRef.current.style.transitionProperty = ''
        pillRef.current.style.transform = ''
        if (cancelled || !drag.moved) return
        // snap to the tab whose center is nearest the release point
        let nearest: TabId | null = null
        let best = Number.POSITIVE_INFINITY
        for (const id of TAB_ORDER) {
            const el = tabRefs.current[id]
            if (!el) continue
            const rect = el.getBoundingClientRect()
            const distance = Math.abs(e.clientX - (rect.left + rect.width / 2))
            if (distance < best) {
                best = distance
                nearest = id
            }
        }
        if (!nearest || nearest === activeTab) return
        triggerHaptic()
        if (nearest === 'support') {
            // overlay, not a route — the drawer opens and the pill glides home
            setIsSupportModalOpen(true)
            return
        }
        setActiveTab(nearest)
        router.push(nearest === 'home' ? '/home' : '/card')
    }

    return (
        // px-4 gutter (L/16): deliberate divergence from the board's px-6 —
        // rulings 17+18 want the bar spanning the viewport on mobile with a
        // minimal edge inset (AppShell's max-w-md wrapper keeps desktop sane)
        <nav className="flex w-full items-center gap-4 px-4 py-2" translate="no">
            <div
                ref={barRef}
                // Hard offset shadow (contrast study "Hard offset shadow"),
                // carried by the bar AND the QR circle so the pair reads as one
                // plane. shadow-4 is the DS token for it (Kush's ruling).
                className="relative flex flex-1 items-center justify-between rounded-round border border-border-default bg-background-page shadow-4"
            >
                <Link
                    href="/home"
                    draggable={false}
                    aria-label={t('home')}
                    onClick={() => {
                        triggerHaptic()
                        setActiveTab('home')
                    }}
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
                    onClick={() => {
                        triggerHaptic()
                        setActiveTab('card')
                    }}
                    className={tabClass}
                    ref={(el) => {
                        tabRefs.current.card = el
                    }}
                >
                    <Icon name="credit-card" size={20} className={iconClass} />
                </Link>
                {/* while the drawer is open the tab shows a static pressed
                    state (white fill) instead of borrowing the route pill */}
                <button
                    type="button"
                    aria-label={t('support')}
                    onClick={() => {
                        triggerHaptic()
                        setIsSupportModalOpen(true)
                    }}
                    className={`${tabClass} ${isSupportModalOpen ? 'bg-background-default' : ''}`}
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
                    their own). Width is set, not animated: all three tabs are
                    px-6 around a 20px icon, so it never changes. */}
                {activeBox && (
                    <span
                        ref={pillRef}
                        aria-hidden
                        data-testid="bottom-nav-pill"
                        onPointerDown={onPillPointerDown}
                        onPointerMove={onPillPointerMove}
                        onPointerUp={(e) => endPillDrag(e, false)}
                        onPointerCancel={(e) => endPillDrag(e, true)}
                        // -1px, not -2px: the bar's own border is 1px, so a 1px inset puts the
                        // pill's outer edge exactly on the bar's — at 2px it stood proud of it.
                        className="absolute -top-px -bottom-px left-0 z-0 touch-none rounded-round border border-border-default bg-background-default motion-safe:transition-transform motion-safe:duration-[250ms] motion-safe:ease-[cubic-bezier(0.3,1.06,0.4,1)]"
                        style={{
                            transform: `translateX(${restingX(activeBox)}px)`,
                            width: activeBox.width + 2,
                        }}
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
                className="flex size-13 shrink-0 items-center justify-center rounded-round border border-border-button bg-action-primary text-foreground-primary shadow-4 transition-transform duration-instant active:scale-95 disabled:opacity-40"
            >
                <Icon name="qr-code" size={24} />
            </button>
        </nav>
    )
}
