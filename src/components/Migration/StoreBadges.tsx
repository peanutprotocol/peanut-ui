'use client'
import { Button } from '@/components/0_Bruddle/Button'
import { STORE_NAME, STORE_URL, type MigrationSurface } from '@/constants/migration.consts'
import { trackStoreClick } from '@/utils/migration.utils'
import { DeviceType, useDeviceType } from '@/hooks/useGetDeviceType'

// store-button pair. compact: under download CTAs and QRs, same design
// language as /app (purple App Store, stroke Google Play). hero: the landing
// hero's desktop CTA row — two equal white buttons on the pink hero. stacked:
// inside a modal, where the platform is usually known — one full-width white
// button for the device you are on, falling back to both, one under the other,
// when it is not.
export default function StoreBadges({
    surface,
    appearance = 'compact',
}: {
    surface: MigrationSurface
    appearance?: 'compact' | 'hero' | 'stacked'
}) {
    const isHero = appearance === 'hero'
    const isStacked = appearance === 'stacked'
    const { deviceType } = useDeviceType()
    const thisPlatform = deviceType === DeviceType.IOS ? 'ios' : deviceType === DeviceType.ANDROID ? 'android' : null
    const stores = isStacked && thisPlatform ? ([thisPlatform] as const) : (['ios', 'android'] as const)
    return (
        <div className={isStacked ? 'flex w-full flex-col gap-3' : 'flex items-center justify-center gap-3'}>
            {stores.map((s) => (
                <a
                    key={s}
                    href={STORE_URL[s]}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => trackStoreClick(s, surface)}
                    className={isStacked ? 'w-full' : undefined}
                >
                    <Button
                        variant={isHero || isStacked ? 'stroke' : s === 'ios' ? 'purple' : 'stroke'}
                        shadowSize="4"
                        size={isHero ? undefined : 'small'}
                        icon={s === 'ios' ? 'apple-logo' : 'google-play'}
                        className={
                            isHero
                                ? 'w-52 bg-white px-6 py-3 text-button-m hover:bg-white/90 md:py-7 md:text-button-l'
                                : isStacked
                                  ? 'w-full justify-center bg-white hover:bg-white/90'
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
