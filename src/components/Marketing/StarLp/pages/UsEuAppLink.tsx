'use client'

import Link from 'next/link'
import { useAppModal } from '@/components/Migration/AppModalProvider'
import { MIGRATION_SURFACES } from '@/constants/migration.consts'
import { twMerge } from '@/utils/tw'
import type { UsEuAppLinkProps } from './usEuAccounts.types'

/**
 * Makes a picture on the page lead where its CTA leads: /app and the download
 * modal, as LandingAppLink does. It sits inside art that duplicates a visible
 * CTA, so it stays out of the tab order. `group` lets the art take the DS press (`group-active:` drops its shadow).
 */
export function UsEuAppLink({ children, className, surface = MIGRATION_SURFACES.STAR_LP }: UsEuAppLinkProps) {
    const interceptAppCta = useAppModal()
    return (
        <Link
            prefetch={false}
            href="/app"
            tabIndex={-1}
            className={twMerge('group', className)}
            onClick={(event) => {
                if (interceptAppCta(surface, 'artwork')) event.preventDefault()
            }}
        >
            {children}
        </Link>
    )
}
