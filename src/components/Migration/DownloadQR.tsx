'use client'
import { useEffect, useRef } from 'react'
import posthog from 'posthog-js'
import { useTranslations } from 'next-intl'
import QRCodeWrapper from '@/components/Global/QRCodeWrapper'
import StorePair from '@/components/Migration/StorePair'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { SELF_URL } from '@/constants/general.consts'
import { type MigrationSurface } from '@/constants/migration.consts'
import type { StoreHandoff } from '@/utils/migration.utils'

/** QR frame width in px — the value QRCodeWrapper's `max-w-*` resolves to.
 *  Static class strings: a template literal would not survive Tailwind's scan. */
const FRAME_WIDTH = {
    160: 'max-w-[160px]',
    192: 'max-w-[192px]',
} as const

export type QRSize = keyof typeof FRAME_WIDTH

// one smart QR instead of a per-store toggle: it encodes /app, which
// redirects to the store of whichever phone scans it.
export default function DownloadQR({
    surface,
    payload,
    size = 160,
    handoff,
}: {
    surface: MigrationSurface
    /** deferred-link querystring from `buildDeferredPayload()` — built by the
     *  caller because it reads `window` (cookies, path) and this component
     *  also renders on the server. */
    payload?: string
    size?: QRSize
    handoff?: StoreHandoff
}) {
    const t = useTranslations('migration')
    const frameRef = useRef<HTMLDivElement>(null)

    // impressions, not mounts: several surfaces render a QR far below the fold
    // (the app fold, the footer), and counting those as shown would make the
    // scan rate look broken. fires once, at 50% visible; in a modal the QR is
    // already fully in view when it mounts, so that is the open event.
    const hasContext = !!payload
    const shown = useRef(false)
    useEffect(() => {
        if (shown.current) return
        const capture = () => {
            if (shown.current) return
            shown.current = true
            posthog.capture(ANALYTICS_EVENTS.MIGRATION_QR_SHOWN, { surface, hasContext })
        }
        const node = frameRef.current
        // no IntersectionObserver (jsdom, ancient webviews): count the mount
        if (!node || typeof IntersectionObserver === 'undefined') {
            capture()
            return
        }
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries.some((e) => e.isIntersecting && e.intersectionRatio >= 0.5)) {
                    capture()
                    observer.disconnect()
                }
            },
            { threshold: 0.5 }
        )
        observer.observe(node)
        return () => observer.disconnect()
    }, [surface, hasContext])

    // the serving origin, not SELF_URL: a preview's QR must point at the
    // preview (SELF_URL would send scanners to prod) and a LAN-served dev
    // build must encode the LAN address so a real phone can scan it
    const origin = typeof window !== 'undefined' ? window.location.origin : SELF_URL
    // /app is the smart link: it reads the payload back off its own querystring
    // and hands it to the store bounce, so context survives the install
    const qrUrl = `${origin}/app?${payload ? `${payload}&` : ''}s=${encodeURIComponent(surface)}`

    return (
        <div className="flex w-full flex-col items-center gap-3 py-2">
            <div ref={frameRef} className="w-full">
                <QRCodeWrapper url={qrUrl} className={FRAME_WIDTH[size]} />
            </div>
            <span className="text-body-xs text-foreground-secondary">{t('qr.scanHint')}</span>
            {/* desktop can install directly too (e.g. Google Play from the browser) */}
            <StorePair surface={surface} appearance="stacked" handoff={handoff} />
        </div>
    )
}
