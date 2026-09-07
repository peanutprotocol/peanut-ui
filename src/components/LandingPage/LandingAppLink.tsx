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
    // Give the OS a real navigation to handle; a Next Link stays inside the SPA.
    // iOS stays on the login handoff page for Safari’s native Open banner.
    if (migrationOn && surface === MIGRATION_SURFACES.LANDING_LOGIN && deviceType !== DeviceType.WEB) {
        return (
            <a href={deviceType === DeviceType.IOS ? '/app/login' : '/app'} className={className}>
                {children}
            </a>
        )
    }
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
