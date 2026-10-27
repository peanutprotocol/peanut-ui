import HandPeace from '@/assets/illustrations/hand-peace.svg'
import { CloseFold } from '@/components/Marketing/StarLp/CloseFold'
import { PersonaFold } from '@/components/Marketing/StarLp/PersonaFold'
import { PopIn } from '@/components/Marketing/StarLp/PopIn'
import { StarLpCta } from '@/components/Marketing/StarLp/StarLpCta'
import { StarLpFaq } from '@/components/Marketing/StarLp/StarLpFaq'
import { StarLpMarquee } from '@/components/Marketing/StarLp/StarLpMarquee'
import { STAR_LP_EARNERS } from '@/components/Marketing/StarLp/starLpPersonas.consts'
import { TrustBand } from '@/components/Marketing/StarLp/TrustBand'
import { Wiggle } from '@/components/Marketing/StarLp/Wiggle'
import { MIGRATION_SURFACES } from '@/constants/migration.consts'
import { singletonLocaleFor } from '@/lib/content'
import { HomeCardFold } from './HomeCardFold'
import { HomeCardGate } from './HomeCardGate'
import { HomeGetPaidFold } from './HomeGetPaidFold'
import { HomeHingeFold } from './HomeHingeFold'
import { HomePayLocalFold } from './HomePayLocalFold'
import { HomeRequestFold } from './HomeRequestFold'
import type { HomeFoldsProps } from './homePage.types'

/**
 * The homepage below the hero and its marquee: get paid (accounts, personas,
 * request link), the balance that joins earning to spending, then spending
 * (card, local QR), trust, FAQ and the close. Built from the star-LP kit.
 * Tickers sit only where the design puts them: under the card fold and over
 * the trust band.
 */
export function HomeFolds({ locale, strings, faqItems, closeCta }: HomeFoldsProps) {
    return (
        <>
            <HomeGetPaidFold strings={strings.getPaid} />
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
            <HomeRequestFold strings={strings.request} />
            <HomeHingeFold strings={strings.hinge} locale={locale} />
            {/* With the card off, its ticker goes too: the ticker names the card. */}
            <HomeCardGate>
                <HomeCardFold strings={strings.card} locale={locale} />
                <StarLpMarquee
                    between={['pink', 'yellow']}
                    ground="sky"
                    words={[strings.seamCard, 'Mercado Pago', 'Pix']}
                />
            </HomeCardGate>
            <HomePayLocalFold strings={strings.payLocal} locale={locale} />
            <StarLpMarquee between={['yellow', 'black']} ground="sky" words={[strings.seamPasskey, 'USD', 'EUR']} />
            <TrustBand text={strings.trustLine} />
            <StarLpFaq
                id="faq"
                items={faqItems}
                footnote={strings.faqFootnote}
                learnMoreLabel={strings.learnMore}
                inLanguage={singletonLocaleFor('landing', locale)}
            />
            <CloseFold
                id="home-close"
                title={strings.closeTitle}
                // The glove sits beside the CTA, as on /us-europe-accounts. Below xs it
                // stacks above the CTA so the large button keeps a one-line label at 320.
                decoration={<></>}
                cta={
                    <div className="flex flex-col items-center gap-3 xs:flex-row md:gap-4">
                        <PopIn tilt={-10} className="pointer-events-none w-12 shrink-0 md:w-16">
                            <Wiggle kind="wobble">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={HandPeace.src}
                                    width={HandPeace.width}
                                    height={HandPeace.height}
                                    alt=""
                                    aria-hidden
                                    loading="lazy"
                                />
                            </Wiggle>
                        </PopIn>
                        <StarLpCta
                            href={closeCta.href}
                            ground="pink"
                            surface={MIGRATION_SURFACES.LANDING_APP_FOLD}
                            qrPlacement="app-fold"
                        >
                            {closeCta.label}
                        </StarLpCta>
                    </div>
                }
            />
        </>
    )
}
