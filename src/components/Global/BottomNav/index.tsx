'use client'

import { Icon } from '@/components/Global/Icons/Icon'
import IndicatorDot from '@/components/Global/IndicatorDot'
import underMaintenanceConfig from '@/config/underMaintenance.config'
import { useModalsContext } from '@/context/ModalsContext'
import { useSupportUnread } from '@/hooks/useSupportUnread'
import { motion, useReducedMotion } from 'framer-motion'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useAppHaptic } from '@/hooks/useAppHaptic'
import { useRef } from 'react'

/**
 * Bottom navigation from the figma navigation board (17802:61534, component
 * 17317:138477): a pill bar with home / card / support tabs plus the pink QR
 * circle button. Active tab = white pill. Every pressable area is 68x52px
 * (24px/16px padding around a 20px icon) — over the 44px touch-target floor.
 *
 * The active pill is a single shared element (framer layoutId) so it slides
 * from the old tab to the tapped one; it is drawn 1px larger on every side
 * (-inset-px) so its border overlays the outer pill border instead of
 * doubling up against it.
 *
 * The pill is also draggable (drag="x", constrained to the bar): hold and
 * drag it along the bar, release, and it snaps to the nearest tab and
 * navigates there. Taps keep working — a click right after a drag is
 * swallowed by the bar's capture handler. Under prefers-reduced-motion the
 * drag is disabled (taps only) and the pill snap is instant.
 */

type TabId = 'home' | 'card' | 'support'

const TAB_ORDER: TabId[] = ['home', 'card', 'support']

// tab pressable: px-6 py-4 + 20px icon = the 68x52 area annotated on the board
const tabClass =
    'relative flex items-center justify-center rounded-round px-6 py-4 text-foreground-primary transition-colors duration-instant focus-visible:outline-[3px] focus-visible:outline-action-focus'

// icons sit above the pill (z) and let pointer events fall through to the
// tab / draggable pill underneath
const iconClass = 'pointer-events-none relative z-10'

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

    // one active tab at a time so the shared pill has a single home
    const activeTab: TabId | null =
        isSupportModalOpen || pathname === '/support'
            ? 'support'
            : (pathname?.startsWith('/card') ?? false)
              ? 'card'
              : pathname === '/home' || pathname === '/home/'
                ? 'home'
                : null

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
            activateTab(nearest)
        }
    }

    const renderPill = (tab: TabId) =>
        activeTab === tab && (
            <motion.span
                aria-hidden
                layoutId="bottom-nav-pill"
                drag={reduceMotion ? false : 'x'}
                dragConstraints={barRef}
                dragElastic={0.05}
                dragMomentum={false}
                dragSnapToOrigin
                onDragStart={() => {
                    didDragRef.current = true
                }}
                onDragEnd={(event) => handleDragEnd(event)}
                className="absolute -inset-px touch-none rounded-round border border-border-default bg-background-default"
                transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 400, damping: 32 }}
            />
        )

    return (
        <nav className="flex w-full items-center gap-4 bg-background-page px-6 py-2" translate="no">
            <div
                ref={barRef}
                onClickCapture={(e) => {
                    if (didDragRef.current) {
                        e.preventDefault()
                        e.stopPropagation()
                    }
                }}
                className="flex flex-1 items-center justify-between rounded-round border border-border-default bg-background-page"
            >
                <Link
                    href="/home"
                    aria-label={t('home')}
                    onClick={() => triggerHaptic()}
                    className={tabClass}
                    ref={(el) => {
                        tabRefs.current.home = el
                    }}
                >
                    {renderPill('home')}
                    <Icon name="home" size={20} className={iconClass} />
                </Link>
                <Link
                    href="/card"
                    aria-label={t('card')}
                    onClick={() => triggerHaptic()}
                    className={tabClass}
                    ref={(el) => {
                        tabRefs.current.card = el
                    }}
                >
                    {renderPill('card')}
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
                    {renderPill('support')}
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
