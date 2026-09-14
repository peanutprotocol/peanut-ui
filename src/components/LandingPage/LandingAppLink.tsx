'use client'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { useMigrationFlag } from '@/hooks/useMigrationFlag'
import { useAppModal } from '@/components/Migration/AppModalProvider'
import type { MigrationSurface } from '@/constants/migration.consts'

export function LandingAppLink({
    href,
    surface,
    className,
    children,
}: {
    href: string
    surface: MigrationSurface
    className?: string
    children: ReactNode
}) {
    const migrationOn = useMigrationFlag()
    const interceptAppCta = useAppModal()
    return (
        <Link
            prefetch={false}
            href={migrationOn ? '/app' : href}
            className={className}
            onClick={(event) => {
                if (interceptAppCta(surface)) event.preventDefault()
            }}
        >
            {children}
        </Link>
    )
}
