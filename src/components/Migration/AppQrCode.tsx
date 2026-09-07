'use client'
import { useEffect, useRef, useState } from 'react'
import posthog from 'posthog-js'
import QRCodeWrapper from '@/components/Global/QRCodeWrapper'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { type MigrationSurface } from '@/constants/migration.consts'
import { buildDeferredPayload } from '@/utils/deferred-link'
import { type StoreHandoff } from '@/utils/migration.utils'
import { twMerge } from '@/utils/tw'

/*
 * QRCodeWrapper sizes itself off the frame's outer width, and the frame adds
 * 16px of padding plus a 2px border on each side to the module area — so a
 * 160px module area is a 196px-wide frame, and 192px is 228px.
 */
const FRAME_WIDTH = {
    160: 'max-w-[196px]',
    192: 'max-w-[228px]',
} as const

/**
 * The bare scan-to-download QR used by the landing lockups (hero, get-the-app
 * fold, footer): a framed code and nothing else, because those layouts place
 * the hint and the store pair themselves. `DownloadQR` stays the packaged
 * hint + pair unit the modal renders.
 *
 * The encoded url is built in an effect, never during render: it needs
 * `window.location` (a preview must encode the preview origin, a LAN dev build
 * the LAN address) and the deferred payload, which reads cookies. Until it
 * resolves, the wrapper shows its own loading state.
 */
export default function AppQrCode({
    surface,
    /** module-area width in px */
    size = 160,
    handoff,
    className,
}: {
    surface: MigrationSurface
    size?: keyof typeof FRAME_WIDTH
    /** where the scanning phone should land after install (fold 4's `dest=/send`, the door's `/card`) */
    handoff?: StoreHandoff
    className?: string
}) {
    const [url, setUrl] = useState('')
    const rootRef = useRef<HTMLDivElement>(null)
    const shown = useRef(false)

    useEffect(() => {
        let payload = ''
        try {
            payload = buildDeferredPayload(handoff?.dest, handoff?.invite)
        } catch {
            // a payload failure must never cost the visitor the download link
        }
        setUrl(`${window.location.origin}/app?${payload ? `${payload}&` : ''}s=${surface}`)
    }, [surface, handoff?.dest, handoff?.invite])

    // impression, not render: the landing page stacks three of these, and only
    // the one a visitor actually scrolls to should count.
    useEffect(() => {
        const node = rootRef.current
        if (!node || !url || shown.current) return
        const fire = () => {
            shown.current = true
            posthog.capture(ANALYTICS_EVENTS.MIGRATION_QR_SHOWN, { surface, hasContext: url.includes('pnutdl=1') })
        }
        if (typeof IntersectionObserver === 'undefined') {
            fire()
            return
        }
        const observer = new IntersectionObserver(
            (entries) => {
                if (shown.current || !entries.some((entry) => entry.isIntersecting)) return
                fire()
                observer.disconnect()
            },
            { threshold: 0.5 }
        )
        observer.observe(node)
        return () => observer.disconnect()
    }, [surface, url])

    return (
        <div data-testid="app-qr-code" ref={rootRef} className={twMerge('w-full', FRAME_WIDTH[size], className)}>
            <QRCodeWrapper url={url} className={FRAME_WIDTH[size]} />
        </div>
    )
}
