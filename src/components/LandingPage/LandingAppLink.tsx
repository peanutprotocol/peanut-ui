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
    // Safari may keep same-domain links on the web, where /app supplies the store fallback.
    if (migrationOn && surface === MIGRATION_SURFACES.LANDING_LOGIN && deviceType !== DeviceType.WEB) {
        return (
            // eslint-disable-next-line @next/next/no-html-link-for-pages -- OS app handoff needs a full navigation.
            <a href="/app" className={className}>
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
