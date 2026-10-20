'use client'

import Link from 'next/link'
import { useAppModal } from '@/components/Migration/AppModalProvider'
import { STAR_LP_HREF } from '@/components/Marketing/StarLp/starLp.consts'
import { MIGRATION_SURFACES } from '@/constants/migration.consts'
import { useMigrationFlag } from '@/hooks/useMigrationFlag'
import { twMerge } from '@/utils/tw'
import type { SelfCustodyAppLinkProps } from './selfCustody.types'

/**
 * Makes a real app capture open what the page's CTA opens: signup (where the
 * passkey is made), or /app and the download modal when the PWA sunset is on.
 * It repeats a visible CTA, so it stays out of the tab order and the
 * accessibility tree; the CTA is the keyboard path.
 */
export function SelfCustodyAppLink({ children, className }: SelfCustodyAppLinkProps) {
    const migrationOn = useMigrationFlag()
    const interceptAppCta = useAppModal()
    return (
        <Link
            href={migrationOn ? '/app' : STAR_LP_HREF.signup}
            prefetch={false}
            tabIndex={-1}
            aria-hidden
            className={twMerge(
                // peanutsplit FinalCta: lift on a mouse hover, sink on press; transform only, off under reduced motion
                'block motion-safe:transition-transform motion-safe:duration-[170ms] motion-safe:ease-out motion-safe:active:translate-y-[0.1rem] motion-safe:active:scale-[0.985] motion-safe:active:rotate-0 motion-safe:active:duration-[90ms] motion-safe:[@media(pointer:fine)]:hover:-translate-y-1 motion-safe:[@media(pointer:fine)]:hover:-rotate-[0.5deg]',
                className
            )}
            onClick={(event) => {
                if (interceptAppCta(MIGRATION_SURFACES.STAR_LP)) event.preventDefault()
            }}
        >
            {children}
        </Link>
    )
}
