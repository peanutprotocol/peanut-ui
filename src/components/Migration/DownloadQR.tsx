'use client'
import { useEffect, useState } from 'react'
import posthog from 'posthog-js'
import { useTranslations } from 'next-intl'
import QRCodeWrapper from '@/components/Global/QRCodeWrapper'
import StoreBadges from '@/components/Migration/StoreBadges'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { SELF_URL } from '@/constants/general.consts'
import { APP_ENTRY_QUERY_PARAM, type MigrationSurface } from '@/constants/migration.consts'
import { buildDeferredPayload } from '@/utils/deferred-link'
import type { StoreHandoff } from '@/utils/migration.utils'

/**
 * QR scans enter through /home, which is claimed by the already-released
 * native shells. Browsers are redirected to /app by the web proxy; installed
 * apps consume the marker and any explicit guest handoff directly.
 */
export default function DownloadQR({ surface, handoff }: { surface: MigrationSurface; handoff?: StoreHandoff }) {
    const t = useTranslations('migration')
    const [payload, setPayload] = useState<string>()
    useEffect(() => {
        setPayload(handoff ? buildDeferredPayload(handoff.dest, handoff.invite) : undefined)
    }, [handoff])

    useEffect(() => {
        posthog.capture(ANALYTICS_EVENTS.MIGRATION_QR_SHOWN, { surface })
    }, [surface])

    // Keep preview and LAN scans on the same server as the displayed QR.
    const origin = typeof window !== 'undefined' ? window.location.origin : SELF_URL

    return (
        <div className="flex w-full flex-col items-center gap-3 py-2">
            <QRCodeWrapper url={`${origin}/home?${APP_ENTRY_QUERY_PARAM}=1${payload ? `&${payload}` : ''}`} />
            <span className="text-body-xs text-foreground-secondary">{t('qr.scanHint')}</span>
            <StoreBadges surface={surface} payload={payload} />
        </div>
    )
}
