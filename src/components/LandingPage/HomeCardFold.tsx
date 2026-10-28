import Sparkle from '@/assets/illustrations/sparkle.svg'
import { Button } from '@/components/0_Bruddle/Button'
import { CTA_MOTION } from '@/components/Marketing/constants'
import { PopIn } from '@/components/Marketing/StarLp/PopIn'
import { DropIn } from '@/components/Marketing/StarLp/DropIn'
import { Band } from '@/components/Marketing/StarLp/Band'
import { PeanutCardHeroFace } from '@/components/Marketing/StarLp/pages/PeanutCardHeroFace'
import { SectionTitle } from '@/components/Marketing/StarLp/SectionTitle'
import { getStarLpLink } from '@/components/Marketing/StarLp/starLpNavigation'
import { HomeCardReceipt } from './HomeCardReceipt'
import type { HomeCardFoldProps } from './homeCard.types'

/**
 * f6: the card's name and promise as a Roboto fold title (Knerd stays in the hero
 * and the close, per /dev/ds), one line and its CTA, beside the
 * card face with an approved purchase on it. The CTA goes to the card page, which
 * carries the card's fees (messaging.md § 11). No countries, flags or trust claims
 * here: card rules bar them. The art is decorative; the title and line say it.
 */
export function HomeCardFold({ strings, locale }: HomeCardFoldProps) {
    const card = getStarLpLink('peanutCard', locale)
    return (
        <Band ground="pink" id="peanut-card">
            <div className="grid items-center gap-12 md:grid-cols-2">
                <div className="grid justify-items-center gap-6 text-center">
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
                    <SectionTitle>
                        <span className="block">{strings.lockup}.</span>
                        <span className="block">{strings.tagline}</span>
                    </SectionTitle>
                    <p className="text-body-l">{strings.line}</p>
                    <div className="grid justify-items-center gap-4">
                        <Button
                            href={card.href}
                            hrefLang={card.hrefLang}
                            aria-describedby={card.languageLabel ? 'home-card-language' : undefined}
                            variant="secondary"
                            size="large"
                            prefetch={false}
                            className={`w-fit ${CTA_MOTION}`}
                        >
                            {strings.cta}
                        </Button>
                        {card.languageLabel && (
                            <p id="home-card-language" className="text-body-s">
                                {card.languageLabel}
                            </p>
                        )}
                    </div>
                </div>
                <div aria-hidden className="grid justify-items-center">
                    <PopIn tilt={-6} className="w-full max-w-sm md:max-w-md">
                        <PeanutCardHeroFace />
                    </PopIn>
                    <DropIn
                        delay={0.3}
                        tilt={-2}
                        className="relative z-10 -mt-16 w-full max-w-64 justify-self-start md:-mt-20"
                    >
                        <HomeCardReceipt strings={strings} locale={locale} />
                    </DropIn>
                </div>
            </div>
        </Band>
    )
}
