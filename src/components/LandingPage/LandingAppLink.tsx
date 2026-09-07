'use client'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { useMigrationFlag } from '@/hooks/useMigrationFlag'
import { useAppModal } from '@/components/Migration/AppModalProvider'
import { MIGRATION_SURFACES, type MigrationSurface } from '@/constants/migration.consts'
import { DeviceType, useDeviceType } from '@/hooks/useGetDeviceType'

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
    const { deviceType } = useDeviceType()
    const interceptAppCta = useAppModal()
    return (
        <Link
            prefetch={false}
            href={migrationOn ? '/app' : href}
            className={className}
            onClick={(event) => {
                // Returning phone users follow the app link so an installed app can open.
                if (surface === MIGRATION_SURFACES.LANDING_LOGIN && deviceType !== DeviceType.WEB) return
                if (interceptAppCta(surface)) event.preventDefault()
            }}
        >
            {children}
        </Link>
    )
}
