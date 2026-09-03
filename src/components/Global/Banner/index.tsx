'use client'

import { useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { usePathname } from 'next/navigation'
import { Notification } from '@/components/0_Bruddle/Notification'
import maintenanceConfig from '@/config/underMaintenance.config'
import { IS_PRODUCTION } from '@/constants/general.consts'
import { logRunMode } from '@/utils/mode'
import { isDemoMode } from '@/utils/demo'

/**
 * App-wide announcement surface. The old marquee banners (beta feedback,
 * GenericBanner) are gone — announcements now render as an inline
 * Notification (maintenance example: figma 17994:21117). Connectivity moved
 * to the toast surface (ConnectivityToast, ruled 2026-09-03) — this banner
 * now only carries maintenance.
 *
 * Placement (designer ruling, 2026-09-03): on app pages the banner renders
 * BELOW the page's nav header — NavHeader mounts it, so every feature page
 * gets it for free. The top-of-shell mounts remain only on surfaces without
 * a NavHeader (setup ribbon, landing). It shows on every page by default;
 * maintenanceBannerPaths in underMaintenance.config scopes it to specific
 * path prefixes (full maintenance always shows it everywhere) — but never
 * on /home: a warning on the money overview reads as "funds at risk" and
 * reduces trust, so home is unconditionally excluded.
 */
interface BannerProps {
    className?: string
    /**
     * feature — title + body copy, for the banner NavHeader mounts below a
     * page's header. global — the short one-liner, for top-of-shell mounts
     * (headerless fallback, setup ribbon, landing).
     */
    variant?: 'feature' | 'global'
}

export function Banner({ className = 'mx-4 mt-2', variant = 'global' }: BannerProps) {
    const pathname = usePathname()
    const t = useTranslations('global')

    // dev-only run-mode console log, kept from the old beta banner so testers
    // can still tell sandbox from real money at a glance in the console
    useEffect(() => {
        if (IS_PRODUCTION) return
        logRunMode()
    }, [])

    if (!pathname) return null

    // demo mode is the app-store review sandbox: synthetic data, no real
    // backend — no announcement applies there
    if (isDemoMode()) return null

    // home never shows a maintenance banner, whatever the config says
    // (designer ruling, 2026-09-03)
    if (pathname === '/home' || pathname.startsWith('/home/')) return null

    const onTargetedPath =
        maintenanceConfig.maintenanceBannerPaths.length === 0 ||
        maintenanceConfig.maintenanceBannerPaths.some((p) => pathname === p || pathname.startsWith(`${p}/`))

    if (maintenanceConfig.enableFullMaintenance || (maintenanceConfig.enableMaintenanceBanner && onTargetedPath)) {
        // full maintenance is a global outage — "everything else works as
        // usual" would be a lie, so the feature copy only applies to the
        // scoped banner mode
        if (variant === 'feature' && !maintenanceConfig.enableFullMaintenance) {
            return (
                <Notification priority="error" title={t('maintenanceTitle')} className={className}>
                    {t('maintenanceBody')}
                </Notification>
            )
        }
        return (
            <Notification priority="error" className={className}>
                {t('maintenanceBanner')}
            </Notification>
        )
    }

    return null
}
