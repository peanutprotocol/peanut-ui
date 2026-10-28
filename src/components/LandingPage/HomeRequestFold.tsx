import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import { CloudsCss } from '@/components/LandingPage/CloudsCss'
import { Band } from '@/components/Marketing/StarLp/Band'
import { SectionTitle } from '@/components/Marketing/StarLp/SectionTitle'
import { STAR_LP_SKY_CLOUDS, STAR_LP_SKY_CLOUDS_CLASS } from '@/components/Marketing/StarLp/starLp.consts'
import { UsEuRequestStrips } from '@/components/Marketing/StarLp/pages/UsEuRequestStrips'
import { getStarLpLink } from '@/components/Marketing/StarLp/starLpNavigation'
import type { HomeRequestFoldProps } from './homeFolds.types'
import { HOME_REQUEST_USD } from './homeFolds.consts'
import { formatUsd } from './homeHinge.utils'

/**
 * f4: someone already on Peanut pays by request link. The us-europe-accounts
 * request strips without the "where do I pay you?" beat. The strips stay
 * unlinked, with the feature link beside the title. From md the strips take the
 * first column and the title the second; stacked, the title comes first. Anyone can pay a request link
 * (product/request-links.md), so the title names no payer.
 */
export function HomeRequestFold({ strings, locale }: HomeRequestFoldProps) {
    const requestLinks = getStarLpLink('requestLinks', locale)
    return (
        <Band ground="sky" id="home-request">
            <CloudsCss clouds={[...STAR_LP_SKY_CLOUDS]} className={STAR_LP_SKY_CLOUDS_CLASS} />
            <div className="grid gap-10 md:grid-cols-2 md:items-center md:gap-12">
                <div className="md:order-last">
                    <SectionTitle>{strings.heading}</SectionTitle>
                    <p className="mt-6">
                        <LinkButton
                            href={requestLinks.href}
                            hrefLang={requestLinks.hrefLang}
                            className="text-foreground-over-color-secondary"
                        >
                            {requestLinks.label}
                            {requestLinks.languageLabel && ` (${requestLinks.languageLabel})`} →
                        </LinkButton>
                    </p>
                </div>
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
