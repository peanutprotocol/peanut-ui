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
 * now only carries maintenance. It shows on every page by default;
 * maintenanceBannerPaths in underMaintenance.config scopes it to specific
 * path prefixes (full maintenance always shows it everywhere).
 */
export function Banner() {
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

    const onTargetedPath =
        maintenanceConfig.maintenanceBannerPaths.length === 0 ||
        maintenanceConfig.maintenanceBannerPaths.some((p) => pathname === p || pathname.startsWith(`${p}/`))

    if (maintenanceConfig.enableFullMaintenance || (maintenanceConfig.enableMaintenanceBanner && onTargetedPath)) {
        return (
            <Notification priority="error" className="mx-4 mt-2">
                {t('maintenanceBanner')}
            </Notification>
        )
    }

    return null
}
