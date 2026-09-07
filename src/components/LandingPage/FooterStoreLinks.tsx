'use client'
import { useMigrationFlag } from '@/hooks/useMigrationFlag'
import { STORE_URL, STORE_NAME } from '@/constants/migration.consts'
export function FooterStoreLinks() {
    const migrationOn = useMigrationFlag()
    if (!migrationOn) return null
    return (
        <div className="mt-6 flex gap-6 text-sm text-white">
            {(['ios', 'android'] as const).map((store) => (
                <a key={store} className="underline" href={STORE_URL[store]} target="_blank" rel="noopener noreferrer">
                    {STORE_NAME[store]}
                </a>
            ))}
        </div>
    )
}
