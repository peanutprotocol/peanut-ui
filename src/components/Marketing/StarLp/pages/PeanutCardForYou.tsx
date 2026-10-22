import { Band } from '@/components/Marketing/StarLp/Band'
import { PopIn } from '@/components/Marketing/StarLp/PopIn'
import { SectionTitle } from '@/components/Marketing/StarLp/SectionTitle'
import { CARD_FOR_YOU_COPY } from './peanutCard.consts'

/**
 * Pink "who it's for" fold. It sits straight above "Probably not for you." with no
 * strip between, as on /shhhhh: the two read as one beat.
 */
export function PeanutCardForYou() {
    return (
        <Band ground="pink" width="prose">
            <PopIn>
                <SectionTitle size="display">{CARD_FOR_YOU_COPY.title}</SectionTitle>
            </PopIn>
            <p className="mt-8 text-body-l">{CARD_FOR_YOU_COPY.body}</p>
        </Band>
    )
}
