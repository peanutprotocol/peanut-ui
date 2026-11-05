'use client'

import Link from 'next/link'
import { useAppModal } from '@/components/Migration/AppModalProvider'
import { MIGRATION_SURFACES } from '@/constants/migration.consts'
import { twMerge } from '@/utils/tw'
import type { QrBrazilAppLinkProps } from './qrBrazil.types'

/**
 * Makes a sticker or a capture open what the page's CTA opens: /app and the
 * download modal. A phone cannot scan
 * its own screen, so a tap on the code does what the scan would. Pressing it
 * gives the DS press: it drops 4px (.qr-br-press, QrBrazilMotionStyle) and its
 * child's 4px shadow goes (`group-active`). Hover adds no motion
 * (design.md § marketing components).
 */
export function QrBrazilAppLink({ children, className, label }: QrBrazilAppLinkProps) {
    const interceptAppCta = useAppModal()
    return (
        <Link
            href="/app"
            prefetch={false}
            {...(label ? { 'aria-label': label } : { tabIndex: -1, 'aria-hidden': true })}
            className={twMerge('qr-br-press group block', className)}
            onClick={(event) => {
                if (interceptAppCta(MIGRATION_SURFACES.STAR_LP, 'artwork')) event.preventDefault()
            }}
        >
            {children}
        </Link>
    )
}
