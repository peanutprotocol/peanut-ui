import { CloseFold } from '@/components/Marketing/StarLp/CloseFold'
import { DropIn } from '@/components/Marketing/StarLp/DropIn'
import { StarLpHero } from '@/components/Marketing/StarLp/StarLpHero'
import { StarLpMarquee } from '@/components/Marketing/StarLp/StarLpMarquee'
import { PeanutCardCta } from './PeanutCardCta'
import { PeanutCardHeroLink } from './PeanutCardHeroLink'
import { PeanutCardNotForYou } from './PeanutCardNotForYou'
import { CARD_RECEIPT_FOLD_COPY } from './peanutCard.consts'
import { PeanutCardReceiptFold } from './PeanutCardReceiptFold'

// Marquee words: card.md (virtual, Visa, issuance free, no monthly fee, freeze and
// limit in the app) under Rain's marketing rules: Visa only as acceptance (§14),
// no debit/prepaid (§6.2), no country or "everywhere" (§7, §12), §15 wording.
const HERO_SEAM: string[] = ['Virtual', 'Pay online', 'US dollars', 'Card details in the app']
const NOT_FOR_YOU_SEAM: string[] = ['Free virtual card', 'No monthly fee', 'Freeze anytime', 'Online and in-app']
const CLOSE_SEAM: string[] = [
    'Accepted wherever Visa is accepted',
    'Peanut Card',
    'Real-world spending',
    'Set your limit',
]

/**
 * /peanut-card: hero, the receipt push, "Probably not for you.", the close. No trust
 * line, no countries: Rain rules bar both on card pages. Folds: pink, cream,
 * black, pink, footer; every seam but cream/black carries a marquee. USD only, so no FX.
 */
export function PeanutCardLanding() {
    return (
        <>
            <StarLpHero
                lead="US Dollar Card"
                knerd={'In\npink'}
                subtitle="Accepted wherever Visa is accepted. Add it to Apple Pay or Google Pay where available in your region, then tap."
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

            <StarLpMarquee between={['pink', 'cream']} words={HERO_SEAM} />

            <PeanutCardReceiptFold title={CARD_RECEIPT_FOLD_COPY.title} />

            <PeanutCardNotForYou />

            <StarLpMarquee between={['black', 'pink']} ground="sky" words={NOT_FOR_YOU_SEAM} />

            <CloseFold title={'Tap\nin pink'} circleWord="pink" cta={<PeanutCardCta placement="close" />} />

            <StarLpMarquee between={['pink', 'black']} words={CLOSE_SEAM} />
        </>
    )
}
