'use client'
import { Button } from '@/components/0_Bruddle/Button'
import { STORE_NAME, type MigrationSurface } from '@/constants/migration.consts'
import { onStoreAnchorClick, storeAnchorHref, type StoreHandoff } from '@/utils/migration.utils'
import { DeviceType, useDeviceType } from '@/hooks/useGetDeviceType'

// store-button pair. compact: under download CTAs and QRs, same design
// language as /app (purple App Store, stroke Google Play). hero: the landing
// hero's desktop CTA row — two equal white buttons on the pink hero. stacked:
// inside a modal, where the platform is usually known — one full-width white
// button for the device you are on, falling back to both, one under the other,
// when it is not.
//
// the buttons are real anchors carrying `storeAnchorHref` (android's install
// referrer rides the url) with `onStoreAnchorClick` for tracking + the iOS
// clipboard hand-off, so a suppressed window.open never costs the bounce.
// pass `handoff` from a surface that knows where the user was heading (a fold
// CTA that used to link /send) so that context survives the install.
export default function StorePair({
    surface,
    appearance = 'compact',
    handoff,
}: {
    surface: MigrationSurface
    appearance?: 'compact' | 'hero' | 'stacked'
    handoff?: StoreHandoff
}) {
    const isHero = appearance === 'hero'
    const isStacked = appearance === 'stacked'
    const { deviceType } = useDeviceType()
    const thisPlatform = deviceType === DeviceType.IOS ? 'ios' : deviceType === DeviceType.ANDROID ? 'android' : null
    const stores = isStacked && thisPlatform ? ([thisPlatform] as const) : (['ios', 'android'] as const)
    return (
        <div
            className={
                isStacked
                    ? 'flex w-full flex-col gap-3'
                    : // wraps rather than overflows: two 208px hero buttons plus the gap
                      // need 428px, more than a 390px phone has, so they stack there
                      'mx-auto flex w-full max-w-[26rem] flex-wrap items-center justify-center gap-3'
            }
        >
            {stores.map((s) => (
                <a
                    key={s}
                    href={storeAnchorHref(s, handoff)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => onStoreAnchorClick(s, surface, handoff)}
                    className={isStacked ? 'w-full' : isHero ? 'w-full sm:w-52' : undefined}
                >
                    <Button
                        variant={isHero || isStacked ? 'stroke' : s === 'ios' ? 'purple' : 'stroke'}
                        shadowSize="4"
                        size={isHero ? undefined : 'small'}
                        icon={s === 'ios' ? 'apple-logo' : 'google-play'}
                        className={
                            isHero
                                ? 'w-full bg-white px-6 py-3 text-button-m hover:bg-white/90 md:py-7 md:text-button-l'
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
