import { Band } from '@/components/Marketing/StarLp/Band'
import { SectionTitle } from '@/components/Marketing/StarLp/SectionTitle'
import { PeanutCardLockScreen } from './PeanutCardLockScreen'
import type { PeanutCardReceiptFoldProps } from './peanutCard.types'

/**
 * The cream fold after the hero: the headline, then the lock screen with the
 * spend's push. No bottom padding, so the fold floor cuts the phone.
 * Up to lg: centred, the phone under the headline (at md a half column would
 * break the headline word by word). lg+: headline and phone side by side as
 * one centred pair, not pushed to the column's two edges.
 * The headline takes the display ramp with the black fold's 390 step (60), so
 * it is never smaller than "Probably not for you." and holds its own beside
 * the lock-screen clock.
 */
export function PeanutCardReceiptFold({ title }: PeanutCardReceiptFoldProps) {
    return (
        <Band ground="cream" className="pb-0 md:pb-0">
            <div className="grid gap-8 lg:grid-cols-[minmax(0,30rem)_25rem] lg:items-center lg:justify-center lg:gap-16">
                <SectionTitle size="display" className="text-center xs:text-heading lg:pb-16 lg:text-left">
                    {title}
                </SectionTitle>
                <PeanutCardLockScreen />
            </div>
        </Band>
    )
}
