'use client'

import Link from 'next/link'
import { useAppModal } from '@/components/Migration/AppModalProvider'
import { MIGRATION_SURFACES } from '@/constants/migration.consts'
import { twMerge } from '@/utils/tw'
import type { QrArgentinaAppLinkProps } from './qrArgentina.types'

/**
 * Makes the till sticker open what the page's CTA
 * opens: /app and the download modal.
 * It repeats a visible CTA, so it stays out of the tab order and the
 * accessibility tree; the CTA is the keyboard path.
 */
export function QrArgentinaAppLink({ children, className }: QrArgentinaAppLinkProps) {
    const interceptAppCta = useAppModal()
    return (
        <Link
            href="/app"
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
