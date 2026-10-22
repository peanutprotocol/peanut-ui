import { CloseFold } from '@/components/Marketing/StarLp/CloseFold'
import { DropIn } from '@/components/Marketing/StarLp/DropIn'
import { StarLpFaq } from '@/components/Marketing/StarLp/StarLpFaq'
import { StarLpHero } from '@/components/Marketing/StarLp/StarLpHero'
import { StarLpMarquee } from '@/components/Marketing/StarLp/StarLpMarquee'
import type { StarLpFaqItem } from '@/components/Marketing/StarLp/starLp.types'
import { marketingBase } from '@/i18n/app/messages.marketing'
import { PeanutCardCta } from './PeanutCardCta'
import { PeanutCardForYou } from './PeanutCardForYou'
import { PeanutCardHeroLink } from './PeanutCardHeroLink'
import { PeanutCardNotForYou } from './PeanutCardNotForYou'
import { PeanutCardPlatinum } from './PeanutCardPlatinum'

// Marquee words: card.md (virtual, Visa, issuance free, no monthly fee, freeze and
// limit in the app) under Rain's marketing rules: Visa only as acceptance (§14),
// no debit/prepaid (§6.2), no country or "everywhere" (§7, §12), §15 wording.
const HERO_SEAM: string[] = ['Virtual', 'Pay online', 'US dollars', 'Card details in the app']
const NOT_FOR_YOU_SEAM: string[] = ['Free virtual card', 'No monthly fee', 'Freeze anytime', 'Online and in-app']
const PLATINUM_SEAM: string[] = ['Bank transfer', 'Exchange withdrawal', 'Stablecoins', 'One balance']
const FAQ_SEAM: string[] = ['No annual fee', 'Set your limit', 'Freeze anytime', 'Peanut Card']
const CLOSE_SEAM: string[] = [
    'Accepted wherever Visa is accepted',
    'Peanut Card',
    'Real-world spending',
    'Set your limit',
]

// /shhhhh's FAQ, word for word, in English: the rest of the page is not localized.
const FAQ_KEYS = ['q1', 'q2', 'q3', 'q5', 'q6', 'q7', 'q8'] as const
const FAQ: StarLpFaqItem[] = FAQ_KEYS.map((id) => ({ id, ...marketingBase.shhhhh.faq[id] }))

/**
 * /peanut-card: hero on the dollar claim, who it's for and "Probably not for you."
 * (one beat, no strip between), "Platinum. But it's pink.", the FAQ, the close in
 * pink (Hugo's review, 22 Oct 2026: dollars first, pink demoted to the close). No
 * trust line, no countries: Rain rules bar both on card pages. Folds: pink, sky,
 * black, pink, cream, pink, footer; every seam but sky/black carries a marquee.
 * The sky fold keeps the pink hero and the pink Platinum fold apart.
 * USD only, so no FX.
 */
export function PeanutCardLanding() {
    return (
        <>
            {/* card.md: USD-denominated card; USD purchases don't convert; non-USD purchases
                convert at the Visa exchange rate + 1% ISA, a Visa fee passed through, no Peanut
                fee on top (Fees). "US dollar" is a currency claim, never issuance (Rain §7). */}
            <StarLpHero
                lead="Peanut Card"
                knerd={'In\ndollars'}
                subtitle="A balance in US dollars, spent as dollars wherever Visa is accepted. Dollar purchases don't convert; other currencies convert at the Visa exchange rate plus 1%, with no Peanut fee on top."
                // the tilt lifts the card's top right corner, where the Visa mark sits, so it starts below the Knerd
                artTuck="none"
                art={
                    <DropIn
                        fromTilt={-24}
                        tilt={-7}
                        className="mx-auto w-full max-w-sm px-2 pb-3 md:max-w-lg md:pb-4 lg:max-w-xl lg:pb-6"
                    >
                        <PeanutCardHeroLink />
                    </DropIn>
                }
                cta={<PeanutCardCta placement="hero" />}
            />

            <StarLpMarquee between={['pink', 'sky']} words={HERO_SEAM} />

            <PeanutCardForYou />

            <PeanutCardNotForYou />

            <StarLpMarquee between={['black', 'pink']} words={NOT_FOR_YOU_SEAM} />

            <PeanutCardPlatinum />

            <StarLpMarquee between={['pink', 'cream']} words={PLATINUM_SEAM} />

            <StarLpFaq items={FAQ} />

            <StarLpMarquee between={['cream', 'pink']} words={FAQ_SEAM} />

            <CloseFold title={'Tap\nin pink'} circleWord="pink" cta={<PeanutCardCta placement="close" />} />

            <StarLpMarquee between={['pink', 'black']} words={CLOSE_SEAM} />
        </>
    )
}
