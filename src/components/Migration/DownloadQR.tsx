'use client'
import { useHydrationSnapshot } from '@/utils/native-platform'
import { useEffect, useState } from 'react'
import posthog from 'posthog-js'
import QRCode from 'react-qr-code'
import { useTranslations } from 'next-intl'
import QRCodeWrapper from '@/components/Global/QRCodeWrapper'
import StoreBadges from '@/components/Migration/StoreBadges'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { SELF_URL } from '@/constants/general.consts'
import { APP_ENTRY_QUERY_PARAM, type MigrationSurface } from '@/constants/migration.consts'
import { buildDeferredPayload } from '@/utils/deferred-link'
import type { StoreHandoff } from '@/utils/migration.utils'
import type { MarketingQrContext } from '@/features/marketing-qr/contract'
import { useMarketingQrUrl } from '@/features/marketing-qr/useMarketingQrUrl'

/**
 * QR scans enter through /home, which is claimed by the already-released
 * native shells. Browsers are redirected to /app by the web proxy; installed
 * apps consume the marker and any explicit guest handoff directly. Explicitly
 * registered marketing placements also enter through /home; the proxy sends
 * their browsers to the /q handoff first.
 */
export default function DownloadQR({
    surface,
    handoff,
    marketingQr,
}: {
    surface: MigrationSurface
    handoff?: StoreHandoff
    marketingQr?: MarketingQrContext
}) {
    const t = useTranslations('migration')
    const [payload, setPayload] = useState<string>()
    const [iosPayload, setIosPayload] = useState<string>()
    useEffect(() => {
        if (!handoff) {
            setPayload(undefined)
            setIosPayload(undefined)
            return
        }
        try {
            setPayload(buildDeferredPayload(handoff.dest, handoff.invite))
            setIosPayload(buildDeferredPayload(handoff.dest, handoff.invite, 'ios'))
        } catch {
            // An unusable handoff must not hide the QR or store links.
            setPayload(undefined)
            setIosPayload(undefined)
        }
    }, [handoff])

    useEffect(() => {
        posthog.capture(ANALYTICS_EVENTS.MIGRATION_QR_SHOWN, { surface })
    }, [surface])

    // Keep preview and LAN scans on the same server as the displayed QR.
    const origin = useHydrationSnapshot(
        () => window.location.origin,
        () => SELF_URL
    )

    // Explicit guest handoffs retain their existing functional campaign context.
    const marketingUrl = useMarketingQrUrl({ origin, context: marketingQr, enabled: !handoff })

    return (
        <div className="flex w-full flex-col items-center gap-3 py-2">
            {marketingUrl ? (
                <div
                    className="mx-auto w-full max-w-[160px] rounded-sm border-2 border-border-default bg-background-default p-4"
                    data-qr-url={marketingUrl}
                >
                    <QRCode
                        value={marketingUrl}
                        level="M"
                        className="ph-no-capture block h-auto w-full"
                        title={t('qr.scanHint')}
                    />
                </div>
            ) : (
                <QRCodeWrapper url={`${origin}/home?${APP_ENTRY_QUERY_PARAM}=1${payload ? `&${payload}` : ''}`} />
            )}
            <span className="text-body-xs text-foreground-secondary">{t('qr.scanHint')}</span>
            <StoreBadges surface={surface} payload={payload} iosPayload={iosPayload} />
        </div>
    )
}
