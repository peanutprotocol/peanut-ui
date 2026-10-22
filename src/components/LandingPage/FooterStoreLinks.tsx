'use client'
import Image from 'next/image'
import { useMigrationFlag } from '@/hooks/useMigrationFlag'
import { STORE_URL, STORE_NAME, MIGRATION_SURFACES, type StoreKind } from '@/constants/migration.consts'
import { trackStoreClick } from '@/utils/migration.utils'
import { DEFAULT_LOCALE, type Locale } from '@/i18n/types'

// The official store badges, in the page's language as both store guidelines
// require. Spanish is one badge for es-419 and es-ar (Apple's es-mx, Google's
// es-419 artwork). They live under public/email because the email templates
// hotlink the English files; one copy serves both.
type BadgeLocale = 'en' | 'es' | 'pt-br'
const BADGE_LOCALE: Record<Locale, BadgeLocale> = { en: 'en', 'es-419': 'es', 'es-ar': 'es', 'pt-br': 'pt-br' }
const STORE_BADGE: Record<StoreKind, Record<BadgeLocale, { src: string; width: number; height: number }>> = {
    ios: {
        en: { src: '/email/app-store-badge.png', width: 324, height: 108 },
        es: { src: '/email/app-store-badge-es.png', width: 323, height: 108 },
        'pt-br': { src: '/email/app-store-badge-pt-br.png', width: 323, height: 108 },
    },
    android: {
        en: { src: '/email/google-play-badge.png', width: 363, height: 108 },
        es: { src: '/email/google-play-badge-es.png', width: 363, height: 108 },
        'pt-br': { src: '/email/google-play-badge-pt-br.png', width: 363, height: 108 },
    },
}

export function FooterStoreLinks({ locale = DEFAULT_LOCALE }: { locale?: Locale }) {
    const migrationOn = useMigrationFlag()
    if (!migrationOn) return null
    const badgeLocale = BADGE_LOCALE[locale] ?? 'en'
    return (
        <div className="mt-6 flex flex-wrap gap-4">
            {(['ios', 'android'] as const).map((store) => {
                const badge = STORE_BADGE[store][badgeLocale]
                return (
                    <a
                        onClick={() => trackStoreClick(store, MIGRATION_SURFACES.LANDING_FOOTER)}
                        key={store}
                        className="flex"
                        href={STORE_URL[store]}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        {/* 40px tall: the minimum both store guidelines allow, and the
                            two badges share one height so they read as a pair. `sizes`
                            keeps the srcset at that size instead of the viewport's. */}
                        <Image
                            src={badge.src}
                            alt={STORE_NAME[store]}
                            width={badge.width}
                            height={badge.height}
                            sizes={`${Math.round((40 * badge.width) / badge.height)}px`}
                            className="h-10 w-auto"
                        />
                    </a>
                )
            })}
        </div>
    )
}
