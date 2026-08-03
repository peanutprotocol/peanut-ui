'use client'
import { Button } from '@/components/0_Bruddle/Button'
import { STORE_NAME, STORE_URL, type MigrationSurface } from '@/constants/migration.consts'
import { trackStoreClick } from '@/utils/migration.utils'

// compact store-button pair under download CTAs and QRs — same design
// language as /app: purple primary for the App Store, stroke for Google Play.
export default function StoreBadges({ surface }: { surface: MigrationSurface }) {
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
                        variant={s === 'ios' ? 'purple' : 'stroke'}
                        shadowSize="4"
                        size="small"
                        icon={s === 'ios' ? 'apple-logo' : 'google-play'}
                        className="w-auto px-4"
                    >
                        {STORE_NAME[s]}
                    </Button>
                </a>
            ))}
        </div>
    )
}
