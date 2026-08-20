'use client'

import { useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { usePathname } from 'next/navigation'
import { Notification } from '@/components/0_Bruddle/Notification'
import { useConnectivity } from '@/hooks/useConnectivity'
import maintenanceConfig from '@/config/underMaintenance.config'
import { IS_PRODUCTION } from '@/constants/general.consts'
import { logRunMode } from '@/utils/mode'
import { isDemoMode } from '@/utils/demo'

/**
 * App-wide announcement surface. The old marquee banners (beta feedback,
 * GenericBanner) are gone — announcements now render as an inline
 * Notification (maintenance example: figma 17994:21117). Precedence:
 * connectivity > maintenance > nothing. The maintenance toggles in
 * underMaintenance.config show it on every page; there is no per-page
 * maintenance flag today.
 */
export function Banner() {
    const pathname = usePathname()
    const connectivity = useConnectivity()
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

    // connectivity wins over maintenance: if the app can't reach the backend,
    // that's the most actionable thing to tell the user right now
    if (connectivity.show) {
        return (
            <Notification priority={connectivity.isOffline ? 'error' : 'attention'} className="mx-4 mt-2">
                {connectivity.isOffline
                    ? "No internet connection — some features won't work until you reconnect"
                    : 'Trouble reaching Peanut — check your connection, retrying…'}
            </Notification>
        )
    }

    if (maintenanceConfig.enableMaintenanceBanner || maintenanceConfig.enableFullMaintenance) {
        return (
            <Notification priority="error" className="mx-4 mt-2">
                {t('maintenanceBanner')}
            </Notification>
        )
    }

    return null
}
