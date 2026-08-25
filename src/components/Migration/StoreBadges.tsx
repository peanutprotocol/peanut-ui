'use client'
import { Button } from '@/components/0_Bruddle/Button'
import { STORE_NAME, STORE_URL, type MigrationSurface } from '@/constants/migration.consts'
import { trackStoreClick } from '@/utils/migration.utils'

// store-button pair. compact: under download CTAs and QRs, same design
// language as /app (purple App Store, stroke Google Play). hero: the landing
// hero's desktop CTA row — two equal white buttons on the pink hero.
export default function StoreBadges({
    surface,
    appearance = 'compact',
}: {
    surface: MigrationSurface
    appearance?: 'compact' | 'hero'
}) {
    const isHero = appearance === 'hero'
    return (
        <div className="flex items-center justify-center gap-3">
            {(['ios', 'android'] as const).map((s) => (
                <a
                    key={s}
                    href={STORE_URL[s]}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => trackStoreClick(s, surface)}
                >
                    <Button
                        variant={isHero ? undefined : s === 'ios' ? 'purple' : 'stroke'}
                        shadowSize="4"
                        size={isHero ? undefined : 'small'}
                        icon={s === 'ios' ? 'apple-logo' : 'google-play'}
                        className={
                            isHero
                                ? 'w-52 bg-white px-6 py-3 text-button-m font-extrabold hover:bg-white/90 md:py-7 md:text-button-l'
                                : 'w-auto px-4'
                        }
                    >
                        {STORE_NAME[s]}
                    </Button>
                </a>
            ))}
        </div>
    )
}
