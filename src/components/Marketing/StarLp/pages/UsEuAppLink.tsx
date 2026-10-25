'use client'

import Link from 'next/link'
import { useAppModal } from '@/components/Migration/AppModalProvider'
import { MIGRATION_SURFACES } from '@/constants/migration.consts'
import { useAuth } from '@/context/authContext'
import { useMigrationFlag } from '@/hooks/useMigrationFlag'
import { twMerge } from '@/utils/tw'
import type { UsEuAppLinkProps } from './usEuAccounts.types'

/**
 * Makes a picture on the page lead where its CTA leads (signed in: straight to
 * the destination), with the same PWA-sunset handling as LandingAppLink. It
 * sits inside art that duplicates a visible CTA, so it stays out of the tab
 * order. `group` lets the art take the DS press (`group-active:` drops its shadow).
 */
export function UsEuAppLink({ href, signedInHref, children, className }: UsEuAppLinkProps) {
    const { user } = useAuth()
    const migrationOn = useMigrationFlag()
    const interceptAppCta = useAppModal()
    const destination = user && signedInHref ? signedInHref : href
    return (
        <Link
            prefetch={false}
            href={migrationOn ? '/app' : destination}
            tabIndex={-1}
            className={twMerge('group', className)}
            onClick={(event) => {
                if (interceptAppCta(MIGRATION_SURFACES.STAR_LP, 'artwork')) event.preventDefault()
            }}
        >
            {children}
        </Link>
    )
}
