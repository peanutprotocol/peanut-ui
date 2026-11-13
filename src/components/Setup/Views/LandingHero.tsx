'use client'

import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { LOGO } from '@/assets/brand'
import sparkle from '@/assets/illustrations/sparkle.svg'
import star from '@/assets/illustrations/star.svg'
import coinEur from '@/assets/illustrations/coin-eur-chip.webp'
import coinUsd from '@/assets/illustrations/coin-usd-chip.webp'
import { Card } from '@/components/0_Bruddle/Card'
import PeanutMascot from '@/components/Global/PeanutMascot'
import StickerPop from '@/components/Setup/components/StickerPop'
import { type SetupHeroProps } from '@/components/Setup/Setup.types'
import { twMerge } from '@/utils/tw'

// Where the sample payment comes from: the two currencies of the bank details. Placed on
// the mascot's box, beside the body, so they keep their place at every size.
const SOURCE_CHIPS = [
    { code: 'USD', coin: coinUsd, rotate: -6, delay: 0.2, className: 'top-1/2 right-2/3 md:top-3/5 tight:right-3/4' },
    { code: 'EUR', coin: coinEur, rotate: 5, delay: 0.3, className: 'top-2/3 left-2/3 tight:left-3/4' },
] as const

/**
 * The Welcome hero (first-screen concept A2, Konrad 2026-11-13): the headline on the blue
 * stage, and the peanut cheering under a sample "money received" card with its USD and EUR
 * sources. The card sits on the mascot's box where the fists reach at the top of the jump,
 * so the fists tuck under its edge and it stays clear of the eyes. Decorative apart from
 * the headline, which is the screen's h1.
 */
export default function LandingHero({ title, still }: SetupHeroProps) {
    const t = useTranslations('setup.landing.hero')
    return (
        <div className="flex h-full w-full flex-col px-6 pt-16 md:px-10 md:pt-16 tight:pt-14">
            {title && (
                // text-heading-l is the marketing size; this hero is a marketing-style first screen (Konrad, 2026-11-13).
                <h1 className="max-w-xs shrink-0 text-left text-heading-l md:max-w-md short:text-heading-m tight:text-heading-s">
                    {title}
                </h1>
            )}
            {/* contain-size: large text grows the hero to fit the headline; the scene gives way, whole. */}
            <div aria-hidden="true" className="relative min-h-0 flex-1 overflow-hidden contain-size">
                <div className="flex h-full flex-col items-center pt-10 md:justify-center tight:pt-8">
                    <div className="relative z-10 shrink-0">
                        <StickerPop still={still} delay={0.1} rotate={-4} bob={4}>
                            <Card
                                shadowSize="4"
                                className="relative w-64 flex-row items-center gap-3 p-3 tight:w-56 tight:p-2"
                            >
                                <span className="flex size-10 shrink-0 items-center justify-center rounded-sm border border-border-default bg-background-accent-yellow tight:size-8">
                                    <Image src={LOGO} alt="" className="h-7 w-auto tight:h-6" />
                                </span>
                                <span className="min-w-0 text-left">
                                    <span className="block text-label-l">{t('received')}</span>
                                    <span className="block text-heading-xs">{t('amount')}</span>
                                </span>
                                <span className="absolute -top-3 left-3 rounded-full border border-border-default bg-background-default px-2 text-label-m">
                                    {t('example')}
                                </span>
                            </Card>
                        </StickerPop>
                        <StickerPop still={still} delay={0.3} className="absolute -top-2 -left-8 w-5 tight:hidden">
                            <Image src={star} alt="" className="h-auto w-full" />
                        </StickerPop>
                        <StickerPop still={still} delay={0.5} className="absolute top-12 -right-7 w-7 tight:hidden">
                            <Image src={star} alt="" className="h-auto w-full" />
                        </StickerPop>
                        <StickerPop
                            still={still}
                            delay={0.5}
                            rotate={-20}
                            className="absolute -top-10 right-3 w-8 tight:-top-8 tight:w-7"
                        >
                            <Image src={sparkle} alt="" className="h-auto w-full" />
                        </StickerPop>
                    </div>

                    {/* The mascot's box: its top band is where the fists reach mid-jump, under the card. */}
                    <div className="relative -mt-14 min-h-0 w-full flex-1 md:-mt-16 md:max-h-120 md:flex-none md:basis-120 short:-mt-12 tight:-mt-6">
                        <div className="absolute inset-y-0 left-1/2 aspect-[849.3/980.8] -translate-x-1/2">
                            {/* shifted down by the art's own bottom margin, so the feet stand on the hero's edge */}
                            <PeanutMascot
                                pose="cheering"
                                className="absolute inset-x-0 top-1/25 -bottom-1/25 h-auto w-full"
                            />
                            {SOURCE_CHIPS.map((chip) => (
                                <StickerPop
                                    key={chip.code}
                                    still={still}
                                    delay={chip.delay}
                                    rotate={chip.rotate}
                                    className={twMerge('absolute z-10', chip.className)}
                                >
                                    <Card className="shadow-2 flex-row items-center gap-2 py-1 pr-3 pl-1 text-label-l tight:gap-1 tight:pr-2 tight:text-label-m">
                                        <Image src={chip.coin} alt="" sizes="28px" className="h-7 w-auto tight:h-5" />
                                        {chip.code}
                                    </Card>
                                </StickerPop>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
