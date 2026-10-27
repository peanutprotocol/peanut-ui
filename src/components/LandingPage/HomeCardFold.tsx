import Exclamations from '@/assets/illustrations/exclamations.svg'
import { Button } from '@/components/0_Bruddle/Button'
import { CTA_MOTION } from '@/components/Marketing/constants'
import { Band } from '@/components/Marketing/StarLp/Band'
import { DisplayLine } from '@/components/Marketing/StarLp/DisplayLine'
import { KnerdTitle } from '@/components/Marketing/StarLp/KnerdTitle'
import { PeanutCardHeroFace } from '@/components/Marketing/StarLp/pages/PeanutCardHeroFace'
import { STAR_LP_ROUTES } from '@/components/Marketing/StarLp/starLp.consts'
import { HomeCardReceipt } from './HomeCardReceipt'
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
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src={Exclamations.src}
                width={Exclamations.width}
                height={Exclamations.height}
                alt=""
                aria-hidden
                className="pointer-events-none absolute -top-10 left-0 w-9 md:-top-16"
            />
            <div className="grid items-center gap-12 md:grid-cols-2">
                <div className="grid justify-items-start gap-6">
                    <h2 className="grid gap-2">
                        <DisplayLine>{strings.lockup}</DisplayLine>
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
                    <div className="relative z-10 -mt-16 w-full max-w-60 -rotate-2 justify-self-start md:-mt-20">
                        <HomeCardReceipt strings={strings} locale={locale} />
                    </div>
                </div>
            </div>
        </Band>
    )
}
