import { CloudsCss } from '@/components/LandingPage/CloudsCss'
import { Band } from '@/components/Marketing/StarLp/Band'
import { SectionTitle } from '@/components/Marketing/StarLp/SectionTitle'
import { STAR_LP_SKY_CLOUDS, STAR_LP_SKY_CLOUDS_CLASS } from '@/components/Marketing/StarLp/starLp.consts'
import { UsEuRequestStrips } from '@/components/Marketing/StarLp/pages/UsEuRequestStrips'
import type { HomeRequestFoldProps } from './homeFolds.types'
import { HOME_REQUEST_USD } from './homeFolds.consts'
import { formatUsd } from './homeHinge.utils'

/**
 * f4: someone already on Peanut pays by request link. The us-europe-accounts
 * request strips without the "where do I pay you?" beat. The home fold has no
 * CTA, so the strips render unlinked: no focusable link sits inside their
 * aria-hidden art. From md the strips take the first column and the title the
 * second; stacked, the title comes first. Anyone can pay a request link
 * (product/request-links.md), so the title names no payer.
 */
export function HomeRequestFold({ strings, locale }: HomeRequestFoldProps) {
    return (
        <Band ground="sky" id="home-request">
            <CloudsCss clouds={[...STAR_LP_SKY_CLOUDS]} className={STAR_LP_SKY_CLOUDS_CLASS} />
            <div className="grid gap-10 md:grid-cols-2 md:items-center md:gap-12">
                <SectionTitle className="md:order-last">{strings.heading}</SectionTitle>
                <UsEuRequestStrips
                    linked={false}
                    // the page's own dollar format: a bare "$" reads as pesos in Argentina
                    amount={formatUsd(HOME_REQUEST_USD, locale, { whole: true })}
                    // the strips fill {username}, {main}, {payer} and {amount} themselves
                    labels={{ requesting: strings.requesting, paid: strings.paid, chatLabel: strings.chatLabel }}
                />
            </div>
        </Band>
    )
}
