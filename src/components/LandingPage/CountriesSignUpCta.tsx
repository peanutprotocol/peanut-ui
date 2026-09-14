'use client'

import { Button } from '@/components/0_Bruddle/Button'
import { useAppModal } from '@/components/Migration/AppModalProvider'
import { MIGRATION_SURFACES } from '@/constants/migration.consts'
import { useMigrationFlag } from '@/hooks/useMigrationFlag'

const BUTTON_CLASS =
    'h-auto w-auto bg-white px-8 py-3 text-sm font-extrabold hover:bg-white/90 active:bg-white/90 md:px-10 md:py-4 md:text-lg'

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
            <Button shadowSize="4" className={BUTTON_CLASS}>
                {label}
            </Button>
        </a>
    )
}
