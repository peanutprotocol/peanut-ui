'use client'

import { Button } from '@/components/0_Bruddle/Button'
import { useAppModal } from '@/components/Migration/AppModalProvider'
import { MIGRATION_SURFACES } from '@/constants/migration.consts'
import { useMigrationFlag } from '@/hooks/useMigrationFlag'
import { CTA_MOTION } from '@/components/Marketing/constants'

/**
 * Keep the illustration server-rendered while this CTA follows the migration flag.
 * The /app href also handles middle-clicks that bypass the modal handler.
 * A hugging DS button fits inside the flag orbit, so it sits centred on the
 * illustration as it shipped; only the button itself is clickable.
 */
export function CountriesSignUpCta({ label }: { label: string }) {
    const interceptAppCta = useAppModal()
    const migrationOn = useMigrationFlag()

    return (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <Button
                size="large"
                href={migrationOn ? '/app' : '/setup'}
                external
                variant="secondary"
                className={`pointer-events-auto w-fit ${CTA_MOTION}`}
                onClick={(event) => {
                    if (interceptAppCta(MIGRATION_SURFACES.LANDING_COUNTRIES)) event.preventDefault()
                }}
            >
                {label}
            </Button>
        </div>
    )
}
