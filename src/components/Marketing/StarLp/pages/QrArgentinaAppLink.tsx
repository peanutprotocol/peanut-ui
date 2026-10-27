'use client'

import Link from 'next/link'
import { useAppModal } from '@/components/Migration/AppModalProvider'
import { STAR_LP_HREF } from '@/components/Marketing/StarLp/starLp.consts'
import { MIGRATION_SURFACES } from '@/constants/migration.consts'
import { useMigrationFlag } from '@/hooks/useMigrationFlag'
import { twMerge } from '@/utils/tw'
import type { QrArgentinaAppLinkProps } from './qrArgentina.types'

/**
 * Makes the till sticker open what the page's CTA
 * opens: signup, or /app and the download modal when the PWA sunset is on.
 * It repeats a visible CTA, so it stays out of the tab order and the
 * accessibility tree; the CTA is the keyboard path.
 */
export function QrArgentinaAppLink({ children, className }: QrArgentinaAppLinkProps) {
    const migrationOn = useMigrationFlag()
    const interceptAppCta = useAppModal()
    return (
        <Link
            href={migrationOn ? '/app' : STAR_LP_HREF.signup}
            prefetch={false}
            tabIndex={-1}
            aria-hidden
            className={twMerge('block', className)}
            onClick={(event) => {
                if (interceptAppCta(MIGRATION_SURFACES.STAR_LP, 'artwork')) event.preventDefault()
            }}
        >
            {children}
        </Link>
    )
}
