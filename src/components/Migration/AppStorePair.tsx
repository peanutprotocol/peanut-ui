'use client'
import { Button } from '@/components/0_Bruddle/Button'
import { STORE_NAME, type MigrationSurface, type StoreKind } from '@/constants/migration.consts'
import { onStoreAnchorClick, storeAnchorHref } from '@/utils/migration.utils'
import { twMerge } from '@/utils/tw'

const STORES: StoreKind[] = ['ios', 'android']

/**
 * The equal App Store / Google Play pair the landing lockups use, as real
 * anchors: the href is the fallback that still navigates where `window.open`
 * is suppressed (in-app browsers, strict popup blockers), and the click
 * handler carries the deferred hand-off — android on the href, iOS on the
 * clipboard, which has to be written inside the tap.
 *
 * `footer` is the same pair on black: white fill, black border, no offset
 * shadow — the treatment the LocaleSwitcher already uses for a light control
 * on the dark footer.
 */
export default function AppStorePair({
    surface,
    layout = 'row',
    className,
}: {
    surface: MigrationSurface
    layout?: 'row' | 'column' | 'footer'
    className?: string
}) {
    const isFooter = layout === 'footer'
    const isColumn = layout === 'column'
    return (
        <div
            className={twMerge(
                'flex w-full max-w-[27.5rem] flex-wrap items-center justify-center gap-3',
                isColumn && 'max-w-[13rem] flex-col',
                isFooter && 'justify-start',
                className
            )}
        >
            {STORES.map((store) => (
                <a
                    key={store}
                    href={storeAnchorHref(store)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => onStoreAnchorClick(store, surface)}
                    className={isColumn ? 'w-full' : 'w-full sm:w-auto'}
                >
                    <Button
                        shadowSize={isFooter ? undefined : '4'}
                        icon={store === 'ios' ? 'apple-logo' : 'google-play'}
                        className={twMerge(
                            'w-full bg-white px-6 text-button-m hover:bg-white/90 sm:w-52 md:text-button-l',
                            isFooter && 'border-n-1 shadow-none hover:shadow-none'
                        )}
                    >
                        {STORE_NAME[store]}
                    </Button>
                </a>
            ))}
        </div>
    )
}
