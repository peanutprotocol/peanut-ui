'use client'

import { Button } from '@/components/0_Bruddle/Button'
import { useAppModal } from '@/components/Migration/AppModalProvider'
import { MIGRATION_SURFACES } from '@/constants/migration.consts'
import { useMigrationFlag } from '@/hooks/useMigrationFlag'

/**
 * Keep the illustration server-rendered while this CTA follows the migration flag.
 * The /app href also handles middle-clicks that bypass the modal handler.
 */
export function CountriesSignUpCta({ label }: { label: string }) {
    const interceptAppCta = useAppModal()
    const migrationOn = useMigrationFlag()

    return (
        <a
            href={migrationOn ? '/app' : '/setup'}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute inset-0 flex items-center justify-center"
            onClick={(event) => {
                if (interceptAppCta(MIGRATION_SURFACES.LANDING_COUNTRIES)) event.preventDefault()
            }}
        >
            <Button variant="secondary" className="w-auto">
                {label}
            </Button>
        </a>
    )
}
