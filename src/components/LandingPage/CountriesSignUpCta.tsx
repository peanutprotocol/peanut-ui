'use client'

import { Button } from '@/components/0_Bruddle/Button'
import { useAppModal } from '@/components/Migration/AppModalProvider'
import { MIGRATION_SURFACES } from '@/constants/migration.consts'
import { useMigrationFlag } from '@/hooks/useMigrationFlag'
import { CTA_WIDTH } from '@/components/Marketing/constants'

/**
 * Keep the illustration server-rendered while this CTA follows the migration flag.
 * The /app href also handles middle-clicks that bypass the modal handler.
 * At app CTA width the button no longer fits inside the flag orbit, so it
 * sits under the illustration instead of on top of it.
 */
export function CountriesSignUpCta({ label }: { label: string }) {
    const interceptAppCta = useAppModal()
    const migrationOn = useMigrationFlag()

    return (
        <a
            href={migrationOn ? '/app' : '/setup'}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 flex justify-center"
            onClick={(event) => {
                if (interceptAppCta(MIGRATION_SURFACES.LANDING_COUNTRIES)) event.preventDefault()
            }}
        >
            <Button variant="secondary" className={CTA_WIDTH}>
                {label}
            </Button>
        </a>
    )
}
