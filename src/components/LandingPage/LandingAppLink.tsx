'use client'
import type { ReactNode } from 'react'
import { Button, type ButtonSize, type ButtonVariant } from '@/components/0_Bruddle/Button'
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
    qrPlacement,
    variant = 'secondary',
    size,
    className,
    children,
}: {
    href: string
    surface: MigrationSurface
    qrPlacement?: string
    variant?: ButtonVariant
    size?: ButtonSize
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
            size={size}
            className={className}
            onClick={(event) => {
                if (qrPlacement ? interceptAppCta(surface, qrPlacement) : interceptAppCta(surface))
                    event.preventDefault()
            }}
        >
            {children}
        </Button>
    )
}
