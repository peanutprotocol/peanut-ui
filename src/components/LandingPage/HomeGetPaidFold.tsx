import { CloudsCss } from '@/components/LandingPage/CloudsCss'
import { Band } from '@/components/Marketing/StarLp/Band'
import { DisplayLine } from '@/components/Marketing/StarLp/DisplayLine'
import { KnerdTitle } from '@/components/Marketing/StarLp/KnerdTitle'
import { STAR_LP_SKY_CLOUDS, STAR_LP_SKY_CLOUDS_CLASS } from '@/components/Marketing/StarLp/starLp.consts'
import { UsEuAccountPair } from '@/components/Marketing/StarLp/pages/UsEuAccountPair'
import { MIGRATION_SURFACES } from '@/constants/migration.consts'
import { HOME_LOCKUP_LINE_CLASS } from './homeFolds.consts'
import type { HomeGetPaidFoldProps } from './homeFolds.types'

/**
 * f2: the us-europe-accounts hero lockup as a home fold. The Roboto line and
 * the Knerd pair make the h2 (the page's one h1 is the home hero); the real
 * USD and EUR account screens sit beside it from md, under it on phones. The
 * pair links to the accounts screen like the star LP's art (hidden from
 * assistive tech, as there), and reports the
 * home's app-fold surface so home clicks stay out of the star-LP funnel.
 */
export function HomeGetPaidFold({ strings }: HomeGetPaidFoldProps) {
    return (
        <Band ground="sky" id="home-get-paid">
            <CloudsCss clouds={[...STAR_LP_SKY_CLOUDS]} className={STAR_LP_SKY_CLOUDS_CLASS} />
            <div className="grid gap-10 md:grid-cols-2 md:items-center md:gap-12">
                <h2>
                    <DisplayLine className={HOME_LOCKUP_LINE_CLASS}>{strings.lead}</DisplayLine>
                    {/* the margin clears the Knerd's ink, which rises above its line box */}
                    <span className="mt-4 block md:mt-6 lg:mt-8">
                        <KnerdTitle text={strings.knerd} size="compact" align="start" />
                    </span>
                </h2>
                {/* Art, as in the star-LP hero: its link is out of the tab order and the close CTA is the
                    keyboard path. The pair is sized for a hero column; here it fills its half and no more. */}
                <div aria-hidden>
                    <UsEuAccountPair surface={MIGRATION_SURFACES.LANDING_APP_FOLD} className="md:pt-0 lg:max-w-none" />
                </div>
            </div>
        </Band>
    )
}
