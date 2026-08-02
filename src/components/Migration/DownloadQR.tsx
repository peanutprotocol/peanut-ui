'use client'
import { useEffect, useState } from 'react'
import posthog from 'posthog-js'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import QRCodeWrapper from '@/components/Global/QRCodeWrapper'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { STORE_NAME, STORE_URL, type MigrationSurface, type StoreKind } from '@/constants/migration.consts'
import { trackStoreClick } from '@/utils/migration.utils'

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
                    <Button
                        key={s}
                        variant={store === s ? 'purple' : 'transparent'}
                        size="small"
                        onClick={() => setStore(s)}
                        className={`w-auto rounded-none px-4 text-sm font-semibold ${store === s ? '' : 'text-grey-1'}`}
                    >
                        {STORE_NAME[s]}
                    </Button>
                ))}
            </div>
            <QRCodeWrapper url={STORE_URL[store]} />
            <span className="text-xs text-grey-1">{t('qr.scanHint')}</span>
            {/* desktop can install directly too (e.g. Google Play from the browser) */}
            <div className="flex items-center gap-4">
                {(['ios', 'android'] as const).map((s) => (
                    <a
                        key={s}
                        href={STORE_URL[s]}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-black underline"
                        onClick={() => trackStoreClick(s, surface)}
                    >
                        {t(s === 'ios' ? 'qr.openIos' : 'qr.openAndroid')}
                    </a>
                ))}
            </div>
        </div>
    )
}
