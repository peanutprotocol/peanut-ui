'use client'

import Link from 'next/link'
import { useAppModal } from '@/components/Migration/AppModalProvider'
import { STAR_LP_HREF } from '@/components/Marketing/StarLp/starLp.consts'
import { MIGRATION_SURFACES } from '@/constants/migration.consts'
import { useMigrationFlag } from '@/hooks/useMigrationFlag'
import { twMerge } from '@/utils/tw'
import type { QrBrazilAppLinkProps } from './qrBrazil.types'

/**
 * Makes a sticker or a capture open what the page's CTA opens: signup, or
 * /app and the download modal when the PWA sunset is on. A phone cannot scan
 * its own screen, so a tap on the code does what the scan would. Pressing it
 * gives the DS press: it drops 4px (.qr-br-press, QrBrazilMotionStyle) and its
 * child's 4px shadow goes (`group-active`). Hover adds no motion
 * (design.md § marketing components).
 */
export function QrBrazilAppLink({ children, className, label }: QrBrazilAppLinkProps) {
    const migrationOn = useMigrationFlag()
    const interceptAppCta = useAppModal()
    return (
        <Link
            href={migrationOn ? '/app' : STAR_LP_HREF.signup}
            prefetch={false}
            {...(label ? { 'aria-label': label } : { tabIndex: -1, 'aria-hidden': true })}
            className={twMerge('qr-br-press group block', className)}
            onClick={(event) => {
                if (interceptAppCta(MIGRATION_SURFACES.STAR_LP)) event.preventDefault()
            }}
        >
            {children}
        </Link>
    )
}
