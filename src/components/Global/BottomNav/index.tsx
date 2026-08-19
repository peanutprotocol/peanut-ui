'use client'

import { Icon } from '@/components/Global/Icons/Icon'
import IndicatorDot from '@/components/Global/IndicatorDot'
import underMaintenanceConfig from '@/config/underMaintenance.config'
import { useModalsContext } from '@/context/ModalsContext'
import { useSupportUnread } from '@/hooks/useSupportUnread'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import { useHaptic } from 'use-haptic'

/**
 * Bottom navigation from the figma navigation board (17802:61534, component
 * 17317:138477): a pill bar with home / card / support tabs plus the pink QR
 * circle button. Active tab = white pill. Every pressable area is 68x52px
 * (24px/16px padding around a 20px icon) — over the 44px touch-target floor.
 */

// tab pill: px-6 py-4 + 20px icon = the 68x52 pressable annotated on the board
const tabClass = (active: boolean) =>
    twMerge(
        'flex items-center justify-center rounded-round px-6 py-4 text-foreground-primary transition-colors duration-instant focus-visible:outline-[3px] focus-visible:outline-action-focus',
        active && 'border border-border-default bg-background-default'
    )

export const BottomNav = () => {
    const t = useTranslations('navigation')
    const pathname = usePathname()
    const { isSupportModalOpen, setIsSupportModalOpen, setIsQRScannerOpen } = useModalsContext()
    const { triggerHaptic } = useHaptic()
    const hasUnreadSupport = useSupportUnread()

    return (
        <nav className="flex w-full items-center gap-4 bg-background-page px-6 py-2" translate="no">
            <div className="flex flex-1 items-center justify-between rounded-round border border-border-default bg-background-page">
                <Link
                    href="/home"
                    aria-label={t('home')}
                    onClick={() => triggerHaptic()}
                    className={tabClass(pathname === '/home' || pathname === '/home/')}
                >
                    <Icon name="home" size={20} />
                </Link>
                <Link
                    href="/card"
                    aria-label={t('card')}
                    onClick={() => triggerHaptic()}
                    className={tabClass(pathname?.startsWith('/card') ?? false)}
                >
                    <Icon name="credit-card" size={20} />
                </Link>
                <button
                    type="button"
                    aria-label={t('support')}
                    onClick={() => {
                        triggerHaptic()
                        setIsSupportModalOpen(true)
                    }}
                    className={tabClass(isSupportModalOpen || pathname === '/support')}
                >
                    <span className="relative">
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
