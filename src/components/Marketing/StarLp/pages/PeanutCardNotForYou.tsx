import { Band } from '@/components/Marketing/StarLp/Band'
import { PopIn } from '@/components/Marketing/StarLp/PopIn'
import { SectionTitle } from '@/components/Marketing/StarLp/SectionTitle'
import { PeanutCardRise } from './PeanutCardRise'
import { CARD_NOT_FOR_YOU_COPY } from './peanutCard.consts'
import { keepTogether } from './peanutCard.utils'

/**
 * "Probably not for you.": the /shhhhh §4 fold under the sky one. The title pops in,
 * then the body follows in steps; the closing fold after it carries the CTA.
 */
export function PeanutCardNotForYou() {
    return (
        <Band ground="black" width="prose">
            <PopIn>
                <SectionTitle size="display">{CARD_NOT_FOR_YOU_COPY.title}</SectionTitle>
            </PopIn>
            {/* No-break spaces keep "Keep it." off a line of its own and the product name whole. */}
            <PeanutCardRise variant="rise" delay={0.1} className="mt-8">
                <p className="text-body-l">{keepTogether(CARD_NOT_FOR_YOU_COPY.body1, 'works. Keep it.')}</p>
            </PeanutCardRise>
            <PeanutCardRise variant="rule" delay={0.2} className="mt-4" />
            <PeanutCardRise variant="rise" delay={0.3} className="pt-4">
                <p className="text-body-l">{keepTogether(CARD_NOT_FOR_YOU_COPY.body2, 'Peanut Card')}</p>
            </PeanutCardRise>
        </Band>
    )
}
