'use client'
import { useEffect, useState } from 'react'
import posthog from 'posthog-js'
import { useTranslations } from 'next-intl'
import QRCodeWrapper from '@/components/Global/QRCodeWrapper'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { STORE_NAME, STORE_URL, type MigrationSurface, type StoreKind } from '@/constants/migration.consts'

// scan-to-download with a store toggle. on desktop we can't know the visitor's
// phone OS, so we show both store QRs behind a toggle instead of guessing.
export default function DownloadQR({ surface }: { surface: MigrationSurface }) {
    const t = useTranslations('migration')
    const [store, setStore] = useState<StoreKind>('ios')

    useEffect(() => {
        posthog.capture(ANALYTICS_EVENTS.MIGRATION_QR_SHOWN, { surface, store })
    }, [surface, store])

    return (
        <div className="flex flex-col items-center gap-3 py-2">
            <div className="flex overflow-hidden rounded-sm border border-n-1">
                {(['ios', 'android'] as const).map((s) => (
                    <button
                        key={s}
                        onClick={() => setStore(s)}
                        className={`px-4 py-1.5 text-sm font-semibold ${store === s ? 'bg-primary-1 text-n-1' : 'bg-white text-grey-1'}`}
                    >
                        {STORE_NAME[s]}
                    </button>
                ))}
            </div>
            <QRCodeWrapper url={STORE_URL[store]} />
            <span className="text-xs text-grey-1">{t('qr.scanHint')}</span>
        </div>
    )
}
