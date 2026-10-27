import Sparkle from '@/assets/illustrations/sparkle.svg'
import { Button } from '@/components/0_Bruddle/Button'
import { CTA_MOTION } from '@/components/Marketing/constants'
import { Band } from '@/components/Marketing/StarLp/Band'
import { DisplayLine } from '@/components/Marketing/StarLp/DisplayLine'
import { KnerdTitle } from '@/components/Marketing/StarLp/KnerdTitle'
import { PeanutCardHeroFace } from '@/components/Marketing/StarLp/pages/PeanutCardHeroFace'
import { STAR_LP_ROUTES } from '@/components/Marketing/StarLp/starLp.consts'
import { HomeCardReceipt } from './HomeCardReceipt'
import { HOME_LOCKUP_LINE_CLASS } from './homeFolds.consts'
import type { HomeCardFoldProps } from './homeCard.types'

/**
 * f6: the card lockup from the /peanut-card hero, one line and its CTA, beside the
 * card face with an approved purchase on it. The CTA goes to the card page, which
 * carries the card's fees (messaging.md § 11). No countries, flags or trust claims
 * here: card rules bar them. The art is decorative; the title and line say it.
 */
export function HomeCardFold({ strings, locale }: HomeCardFoldProps) {
    return (
        <Band ground="pink" id="peanut-card">
            <div className="grid items-center gap-12 md:grid-cols-2">
                <div className="grid justify-items-start gap-6">
                    {/* in flow, so the sparkle stays over the title at every width and in every locale */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={Sparkle.src}
                        width={Sparkle.width}
                        height={Sparkle.height}
                        alt=""
                        aria-hidden
                        className="pointer-events-none w-9"
                    />
                    {/* the gap clears the Knerd's ink, which rises above its line box */}
                    <h2 className="grid gap-4 md:gap-6 lg:gap-8">
                        <DisplayLine className={HOME_LOCKUP_LINE_CLASS}>{strings.lockup}</DisplayLine>
                        <KnerdTitle text={strings.knerd} size="compact" />
                    </h2>
                    <p className="text-body-l">{strings.line}</p>
                    <Button
                        href={STAR_LP_ROUTES.peanutCard}
                        variant="secondary"
                        size="large"
                        prefetch={false}
                        className={`w-fit ${CTA_MOTION}`}
                    >
                        {strings.cta}
                    </Button>
                </div>
                <div aria-hidden className="grid justify-items-center">
                    <div className="w-full max-w-sm -rotate-6 md:max-w-md">
                        <PeanutCardHeroFace />
                    </div>
                    <div className="relative z-10 -mt-16 w-full max-w-64 -rotate-2 justify-self-start md:-mt-20">
                        <HomeCardReceipt strings={strings} locale={locale} />
                    </div>
                </div>
            </div>
        </Band>
    )
}
