'use client'
import type { ReactNode } from 'react'
import { Button, type ButtonSize, type ButtonVariant } from '@/components/0_Bruddle/Button'
import { useAppModal } from '@/components/Migration/AppModalProvider'
import type { MigrationSurface } from '@/constants/migration.consts'

/**
 * A landing CTA that leads to the app: a link-mode Button (one anchor,
 * design.md — never a Button nested in a link) to /app whose click the shared
 * download modal may take over.
 */
export function LandingAppLink({
    surface,
    qrPlacement,
    variant = 'secondary',
    size,
    className,
    children,
}: {
    surface: MigrationSurface
    qrPlacement?: string
    variant?: ButtonVariant
    size?: ButtonSize
    className?: string
    children: ReactNode
}) {
    const interceptAppCta = useAppModal()
    return (
        <Button
            prefetch={false}
            href="/app"
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
