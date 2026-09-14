'use client'
import { useEffect, useState } from 'react'
import posthog from 'posthog-js'
import { useTranslations } from 'next-intl'
import QRCodeWrapper from '@/components/Global/QRCodeWrapper'
import StoreBadges from '@/components/Migration/StoreBadges'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { SELF_URL } from '@/constants/general.consts'
import { type MigrationSurface } from '@/constants/migration.consts'
import { buildDeferredPayload } from '@/utils/deferred-link'
import type { StoreHandoff } from '@/utils/migration.utils'

/** Generic downloads encode bare /app; explicit guest handoffs also carry their campaign and destination. */
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
            <QRCodeWrapper url={`${origin}/app${payload ? `?${payload}` : ''}`} />
            <span className="text-body-xs text-foreground-secondary">{t('qr.scanHint')}</span>
            <StoreBadges surface={surface} payload={payload} />
        </div>
    )
}
