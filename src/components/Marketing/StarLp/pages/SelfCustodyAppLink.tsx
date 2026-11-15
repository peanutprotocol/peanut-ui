'use client'

import Link from 'next/link'
import { useAppModal } from '@/components/Migration/AppModalProvider'
import { MIGRATION_SURFACES } from '@/constants/migration.consts'
import { twMerge } from '@/utils/tw'
import type { SelfCustodyAppLinkProps } from './selfCustody.types'

/**
 * Makes a real app capture open what the page's CTA opens: /app and the
 * download modal.
 * It repeats a visible CTA, so it stays out of the tab order and the
 * accessibility tree; the CTA is the keyboard path. A press is the DS press:
 * it drops 4px and the phone inside drops its 4px shadow (`group-active`).
 * Hover adds no motion (design.md § marketing components).
 */
export function SelfCustodyAppLink({ children, className }: SelfCustodyAppLinkProps) {
    const interceptAppCta = useAppModal()
    return (
        <Link
            href="/app"
            prefetch={false}
            tabIndex={-1}
            aria-hidden
            className={twMerge(
                'group block transition-transform duration-instant active:translate-x-1 active:translate-y-1',
                className
            )}
            onClick={(event) => {
                if (interceptAppCta(MIGRATION_SURFACES.STAR_LP, 'artwork')) event.preventDefault()
            }}
        >
            {children}
        </Link>
    )
}
