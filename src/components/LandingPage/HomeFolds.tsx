import { Suspense } from 'react'
import { CloseFold } from '@/components/Marketing/StarLp/CloseFold'
import { CloseGloveCta } from '@/components/Marketing/StarLp/CloseGloveCta'
import { PersonaFold } from '@/components/Marketing/StarLp/PersonaFold'
import { StarLpCta } from '@/components/Marketing/StarLp/StarLpCta'
import { StarLpFaq } from '@/components/Marketing/StarLp/StarLpFaq'
import { StarLpMarquee } from '@/components/Marketing/StarLp/StarLpMarquee'
import { STAR_LP_EARNERS } from '@/components/Marketing/StarLp/starLpPersonas.consts'
import { MIGRATION_SURFACES } from '@/constants/migration.consts'
import { WALL_OF_LOVE_POSTS } from '@/constants/tweets.consts'
import { singletonLocaleFor } from '@/lib/content'
import { HomeCardFold } from './HomeCardFold'
import { HomeCardGate } from './HomeCardGate'
import { HomeGetPaidFold } from './HomeGetPaidFold'
import { HomeHingeFold } from './HomeHingeFold'
import { HomePayLocalFold } from './HomePayLocalFold'
import { HomeRequestFold } from './HomeRequestFold'
import { HomeWallOfLove } from './HomeWallOfLove'
import { NoFees } from './noFees'
import { SecurityBuiltIn } from './securityBuiltIn'
import type { HomeFoldsProps } from './homePage.types'

/**
 * The homepage below the hero and its marquee: get paid (accounts, personas,
 * request link), the balance that joins earning to spending, then spending
 * (card, local QR), trust (security, fees, real posts), FAQ and the close.
 * Built from the star-LP kit, with its marquee rule: a strip on every seam a
 * pink, sky or yellow fold touches, the footer counting as black.
 */
export function HomeFolds({ locale, strings, contentHrefs, faqItems, closeCta }: HomeFoldsProps) {
    const { seams } = strings
    return (
        <>
            <HomeGetPaidFold strings={strings.getPaid} />
            <StarLpMarquee between={['sky', 'yellow']} words={seams.accounts} />
            <PersonaFold
                title={strings.personas.heading}
                cards={[
                    {
                        ...STAR_LP_EARNERS.designer,
                        who: strings.personas.designerWho,
                        line: strings.personas.designerLine,
                    },
                    {
                        ...STAR_LP_EARNERS.developer,
                        who: strings.personas.developerWho,
                        line: strings.personas.developerLine,
                    },
                ]}
            />
            <StarLpMarquee between={['yellow', 'sky']} words={seams.personas} />
            <HomeRequestFold strings={strings.request} locale={locale} />
            <StarLpMarquee between={['sky', 'cream']} words={seams.link} />
            <HomeHingeFold strings={strings.hinge} locale={locale} />
            {/* Sky also clears the yellow fold below when the card is off. */}
            <StarLpMarquee between={['cream', 'pink']} words={seams.balance} />
            {/* With the card off, its ticker goes too: the ticker names the card. */}
            <HomeCardGate>
                <HomeCardFold strings={strings.card} locale={locale} />
                <StarLpMarquee between={['pink', 'yellow']} words={seams.card} />
            </HomeCardGate>
            <HomePayLocalFold strings={strings.payLocal} locale={locale} />
            <StarLpMarquee between={['yellow', 'pink']} words={seams.passkey} />
            <SecurityBuiltIn locale={locale} />
            <StarLpMarquee between={['pink', 'sky']} words={seams.accountFees} />
            {/* NoFees renders ExchangeRateWidget, which reads the URL's search params. */}
            <Suspense>
                <NoFees strings={strings} contentHrefs={contentHrefs} />
            </Suspense>
            <StarLpMarquee between={['sky', 'pink']} words={seams.transferFees} />
            <HomeWallOfLove heading={strings.wallOfLove} posts={WALL_OF_LOVE_POSTS} />
            <StarLpMarquee between={['pink', 'cream']} words={seams.faq} />
            <StarLpFaq
                id="faq"
                items={faqItems}
                footnote={strings.faqFootnote}
                learnMoreLabel={strings.learnMore}
                inLanguage={singletonLocaleFor('landing', locale)}
            />
            <StarLpMarquee between={['cream', 'pink']} words={seams.close} />
            <CloseFold
                id="home-close"
                title={strings.closeTitle}
                // The glove sits beside the CTA, as on /us-europe-accounts.
                decoration={<></>}
                cta={
                    <CloseGloveCta>
                        <StarLpCta
                            href={closeCta.href}
                            ground="pink"
                            surface={MIGRATION_SURFACES.LANDING_APP_FOLD}
                            qrPlacement="app-fold"
                        >
                            {closeCta.label}
                        </StarLpCta>
                    </CloseGloveCta>
                }
            />
            <StarLpMarquee between={['pink', 'black']} words={seams.footer} />
        </>
    )
}
