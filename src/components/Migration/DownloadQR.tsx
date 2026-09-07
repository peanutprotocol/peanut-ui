'use client'
import { useEffect, useRef, useState } from 'react'
import posthog from 'posthog-js'
import { useTranslations } from 'next-intl'
import QRCodeWrapper from '@/components/Global/QRCodeWrapper'
import StorePair from '@/components/Migration/StorePair'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { SELF_URL } from '@/constants/general.consts'
import { type MigrationSurface } from '@/constants/migration.consts'
import { buildDeferredPayload } from '@/utils/deferred-link'
import type { StoreHandoff } from '@/utils/migration.utils'
import { twMerge } from '@/utils/tw'

/** QR frame width in px — the value QRCodeWrapper's `max-w-*` resolves to.
 *  Static class strings: a template literal would not survive Tailwind's scan.
 *
 *  The MODULE area is 36px narrower than the frame (2×16px `p-4` + 2×2px
 *  `border-2`), so pick by the module area the surface needs:
 *    160 → 124px modules (today's default everywhere)
 *    192 → 156px modules — the landing hero
 *    224 → 188px modules — the app fold and the footer, where the brief asks
 *          for ~192px of modules and the code sits far from the reader.
 */
const FRAME_WIDTH = {
    160: 'max-w-[160px]',
    192: 'max-w-[192px]',
    224: 'max-w-[224px]',
} as const

export type QRSize = keyof typeof FRAME_WIDTH

type DownloadQRProps = {
    surface: MigrationSurface
    size?: QRSize
    /**
     * Frame only — no scan hint, no store pair. The landing lockups (hero,
     * get-the-app fold, footer) place those themselves, around a layout the
     * packaged unit cannot express; the modal and every other surface keep the
     * packaged QR + hint + pair.
     */
    bare?: boolean
    className?: string
} & (
    | {
          /** deferred-link querystring from `buildDeferredPayload()`, for a caller
           *  that already holds one. */
          payload?: string
          handoff?: never
      }
    | {
          payload?: never
          /** where this surface was sending the user before the sunset (a fold CTA
           *  that used to link /send). The payload is derived from it after mount
           *  and handed to BOTH the QR and the store buttons underneath, so the two
           *  can never carry different context. */
          handoff?: StoreHandoff
      }
)

// one smart QR instead of a per-store toggle: it encodes /app, which
// redirects to the store of whichever phone scans it.
/* the only text in this component. Its own child so `bare` — which renders no
 * copy at all — does not drag an intl provider requirement into the landing
 * lockups, which place their own hint. */
function ScanHint() {
    const t = useTranslations('migration')
    return <span className="text-body-xs text-foreground-secondary">{t('qr.scanHint')}</span>
}

export default function DownloadQR({ surface, payload, size = 160, handoff, bare, className }: DownloadQRProps) {
    const frameRef = useRef<HTMLDivElement>(null)

    // one context channel, two consumers. `handoff` is the input; the querystring
    // the QR encodes is derived from it here rather than by the caller, so a
    // surface cannot hand the buttons a destination and the QR nothing (they are
    // mutually exclusive in the props type for the same reason). Derived after
    // mount because buildDeferredPayload reads window (cookies, path) and this
    // component also renders on the server.
    const derivesPayload = !!handoff
    const [derivedPayload, setDerivedPayload] = useState<string | null>(null)
    // gates the impression event: capturing before the payload exists would
    // report hasContext:false for every contextful QR
    const [contextReady, setContextReady] = useState(!derivesPayload)
    const dest = handoff?.dest
    const invite = handoff?.invite
    useEffect(() => {
        if (!derivesPayload) return
        try {
            setDerivedPayload(buildDeferredPayload(dest, invite))
        } catch {
            // a payload failure must never cost the QR itself
        }
        setContextReady(true)
    }, [derivesPayload, dest, invite])
    const effectivePayload = payload ?? derivedPayload ?? undefined

    // impressions, not mounts: several surfaces render a QR far below the fold
    // (the app fold, the footer), and counting those as shown would make the
    // scan rate look broken. fires once, at 50% visible; in a modal the QR is
    // already fully in view when it mounts, so that is the open event.
    const hasContext = !!effectivePayload
    const shown = useRef(false)
    useEffect(() => {
        if (!contextReady || shown.current) return
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
    }, [surface, hasContext, contextReady])

    // the serving origin, not SELF_URL: a preview's QR must point at the
    // preview (SELF_URL would send scanners to prod) and a LAN-served dev
    // build must encode the LAN address so a real phone can scan it
    const origin = typeof window !== 'undefined' ? window.location.origin : SELF_URL
    // /app is the smart link: it reads the payload back off its own querystring
    // and hands it to the store bounce, so context survives the install
    const qrUrl = `${origin}/app?${effectivePayload ? `${effectivePayload}&` : ''}s=${encodeURIComponent(surface)}`

    const frame = (
        <div
            data-testid="app-qr-code"
            ref={frameRef}
            className={twMerge('w-full', bare && FRAME_WIDTH[size], className)}
        >
            <QRCodeWrapper url={qrUrl} className={FRAME_WIDTH[size]} />
        </div>
    )

    if (bare) return frame

    return (
        <div className="flex w-full flex-col items-center gap-3 py-2">
            {frame}
            <ScanHint />
            {/* desktop can install directly too (e.g. Google Play from the browser) */}
            <StorePair surface={surface} appearance="stacked" handoff={handoff} />
        </div>
    )
}
