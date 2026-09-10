'use client'
import { useMigrationFlag } from '@/hooks/useMigrationFlag'
import { STORE_URL, STORE_NAME, MIGRATION_SURFACES } from '@/constants/migration.consts'
import { trackStoreClick } from '@/utils/migration.utils'
export function FooterStoreLinks() {
    const migrationOn = useMigrationFlag()
    if (!migrationOn) return null
    return (
        <div className="mt-6 flex gap-6 text-sm text-white">
            {(['ios', 'android'] as const).map((store) => (
                <a
                    onClick={() => trackStoreClick(store, MIGRATION_SURFACES.LANDING_FOOTER)}
                    key={store}
                    className="underline"
                    href={STORE_URL[store]}
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    {STORE_NAME[store]}
                </a>
            ))}
        </div>
    )
}
