'use client'
import { useEffect } from 'react'
import posthog from 'posthog-js'
import { useTranslations } from 'next-intl'
import QRCodeWrapper from '@/components/Global/QRCodeWrapper'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { SELF_URL } from '@/constants/general.consts'
import { STORE_URL, type MigrationSurface } from '@/constants/migration.consts'
import { trackStoreClick } from '@/utils/migration.utils'

// one smart QR instead of a per-store toggle: it encodes /app, which
// redirects to the store of whichever phone scans it.
export default function DownloadQR({ surface }: { surface: MigrationSurface }) {
    const t = useTranslations('migration')

    useEffect(() => {
        posthog.capture(ANALYTICS_EVENTS.MIGRATION_QR_SHOWN, { surface })
    }, [surface])

    // the serving origin, not SELF_URL: a preview's QR must point at the
    // preview (SELF_URL would send scanners to prod) and a LAN-served dev
    // build must encode the LAN address so a real phone can scan it
    const origin = typeof window !== 'undefined' ? window.location.origin : SELF_URL

    return (
        <div className="flex flex-col items-center gap-3 py-2">
            <QRCodeWrapper url={`${origin}/app`} />
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
