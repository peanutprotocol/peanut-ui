'use client'
import Image from 'next/image'
import { useMigrationFlag } from '@/hooks/useMigrationFlag'
import { STORE_URL, STORE_NAME, MIGRATION_SURFACES, type StoreKind } from '@/constants/migration.consts'
import { trackStoreClick } from '@/utils/migration.utils'

// The official store badges. They live under public/email because the email
// templates hotlink the same files; one copy serves both.
const STORE_BADGE: Record<StoreKind, { src: string; width: number; height: number }> = {
    ios: { src: '/email/app-store-badge.png', width: 324, height: 108 },
    android: { src: '/email/google-play-badge.png', width: 363, height: 108 },
}

export function FooterStoreLinks() {
    const migrationOn = useMigrationFlag()
    if (!migrationOn) return null
    return (
        <div className="mt-6 flex flex-wrap gap-4">
            {(['ios', 'android'] as const).map((store) => (
                <a
                    onClick={() => trackStoreClick(store, MIGRATION_SURFACES.LANDING_FOOTER)}
                    key={store}
                    className="flex"
                    href={STORE_URL[store]}
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    {/* 40px tall: the minimum both store guidelines allow, and the
                        two badges share one height so they read as a pair */}
                    <Image
                        src={STORE_BADGE[store].src}
                        alt={STORE_NAME[store]}
                        width={STORE_BADGE[store].width}
                        height={STORE_BADGE[store].height}
                        className="h-10 w-auto"
                    />
                </a>
            ))}
        </div>
    )
}
