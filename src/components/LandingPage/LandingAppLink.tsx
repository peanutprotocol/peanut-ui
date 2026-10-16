'use client'
import type { ReactNode } from 'react'
import { Button, type ButtonVariant } from '@/components/0_Bruddle/Button'
import { useMigrationFlag } from '@/hooks/useMigrationFlag'
import { useAppModal } from '@/components/Migration/AppModalProvider'
import type { MigrationSurface } from '@/constants/migration.consts'

/**
 * A landing CTA that follows the migration flag: a link-mode Button (one
 * anchor, design.md — never a Button nested in a link) whose click the shared
 * download modal may take over.
 */
export function LandingAppLink({
    href,
    surface,
    variant = 'secondary',
    className,
    children,
}: {
    href: string
    surface: MigrationSurface
    variant?: ButtonVariant
    className?: string
    children: ReactNode
}) {
    const migrationOn = useMigrationFlag()
    const interceptAppCta = useAppModal()
    return (
        <Button
            prefetch={false}
            href={migrationOn ? '/app' : href}
            variant={variant}
            className={className}
            onClick={(event) => {
                if (interceptAppCta(surface)) event.preventDefault()
            }}
        >
            {children}
        </Button>
    )
}
