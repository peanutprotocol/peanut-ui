import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import { CloudsCss } from '@/components/LandingPage/CloudsCss'
import { Band } from '@/components/Marketing/StarLp/Band'
import { SectionTitle } from '@/components/Marketing/StarLp/SectionTitle'
import { STAR_LP_SKY_CLOUDS, STAR_LP_SKY_CLOUDS_CLASS } from '@/components/Marketing/StarLp/starLp.consts'
import { UsEuAccountPair } from '@/components/Marketing/StarLp/pages/UsEuAccountPair'
import { getStarLpLink } from '@/components/Marketing/StarLp/starLpNavigation'
import { MIGRATION_SURFACES } from '@/constants/migration.consts'
import type { HomeGetPaidFoldProps } from './homeFolds.types'

/**
 * f2: the us-europe-accounts promise as a home fold. The h2 is a Roboto fold
 * title, not a Knerd lockup: /dev/ds keeps Knerd to the hero, the close and OG
 * amounts, and a second hero-size lockup mid-page read as a second hero. The
 * real USD and EUR account screens sit beside it from md, under it on phones. The
 * pair links to the accounts screen like the star LP's art (hidden from
 * assistive tech, as there), and reports the
 * home's app-fold surface so home clicks stay out of the star-LP funnel.
 */
export function HomeGetPaidFold({ strings, locale }: HomeGetPaidFoldProps) {
    const accounts = getStarLpLink('usEuAccounts', locale)
    return (
        <Band ground="sky" id="home-get-paid">
            <CloudsCss clouds={[...STAR_LP_SKY_CLOUDS]} className={STAR_LP_SKY_CLOUDS_CLASS} />
            <div className="grid gap-10 md:grid-cols-2 md:items-center md:gap-12">
                <div>
                    <SectionTitle>{strings.heading}</SectionTitle>
                    <p className="mt-6">
                        <LinkButton
                            href={accounts.href}
                            hrefLang={accounts.hrefLang}
                            className="text-foreground-over-color-primary"
                        >
                            {accounts.label}
                            {accounts.languageLabel && ` (${accounts.languageLabel})`} →
                        </LinkButton>
                    </p>
                </div>
                {/* Art, as in the star-LP hero: its link is out of the tab order and the close CTA is the
                    keyboard path. The pair is sized for a hero column; here it fills its half and no more. */}
                <div aria-hidden>
                    <UsEuAccountPair
                        pairedEntrance
                        surface={MIGRATION_SURFACES.LANDING_APP_FOLD}
                        className="md:pt-0 lg:max-w-none"
                    />
                </div>
            </div>
        </Band>
    )
}
