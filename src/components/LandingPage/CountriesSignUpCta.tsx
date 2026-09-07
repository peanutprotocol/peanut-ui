'use client'

import { Button } from '@/components/0_Bruddle/Button'
import { useAppModal } from '@/components/Migration/AppModalProvider'
import { MIGRATION_SURFACES } from '@/constants/migration.consts'
import { useMigrationFlag } from '@/hooks/useMigrationFlag'

const BUTTON_CLASS =
    'h-auto w-auto bg-white px-8 py-3 text-sm font-extrabold hover:bg-white/90 md:px-10 md:py-4 md:text-lg'

/**
 * The SIGN UP button sitting inside the countries illustration. The fold around
 * it stays a server component; only this button has to know about the migration
 * flag, because during the window it stops being a signup and becomes the
 * download hand-off (QR modal on desktop, the visitor's store on a phone).
 *
 * The href moves to /app with the flag on, so no signup url is left in the DOM
 * even for a middle-click that never reaches the handler.
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
