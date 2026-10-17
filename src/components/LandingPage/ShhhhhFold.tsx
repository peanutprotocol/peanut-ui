'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import { CTA_MOTION } from '@/components/Marketing/constants'

// The card face renders nothing on the server and rasterises four canvases on
// mount, so it stays out of the first chunk. The host box reserves the aspect
// ratio, which keeps the fold from shifting when the chunk lands.
const ScaledPixelatedCardFace = dynamic(
    () => import('@/components/Card/share-asset/ScaledPixelatedCardFace').then((m) => m.ScaledPixelatedCardFace),
    { ssr: false }
)

// On a black ground a black drop shadow is invisible, so the card's shadow
// carries brand pink here. Deliberate deviation from the all-black-shadow
// rule, and it applies on this fold only.
const PINK = 'var(--color-background-brand)'

/** Public card entry on the homepage. */
export function ShhhhhFold() {
    const t = useTranslations('shhhhh.hero')

    return (
        <section
            id="peanut-card"
            className="relative overflow-hidden bg-gray-950 px-6 py-16 text-white md:px-4 md:py-24"
        >
            <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-8 md:grid-cols-[1.1fr_0.9fr] md:gap-12">
                <div className="min-w-0">
                    <Link
                        prefetch={false}
                        href="/shhhhh"
                        className="font-roboto-flex-extrabold inline-block text-heading leading-none font-extraBlack md:text-headingLarge"
                    >
                        {t('wordmark')}
                    </Link>

                    <p className="font-roboto-flex-extrabold mt-6 max-w-xl text-heading-s uppercase md:text-heading-m">
                        {t('tagline')}
                    </p>

                    <div className="mt-8 flex flex-wrap items-center gap-6">
                        {/* primary on the black ground: the secondary's black
                            offset shadow vanishes on gray-950, the pink fill
                            reads (as on the /shhhhh closer) */}
                        <Button
                            size="large"
                            prefetch={false}
                            href="/shhhhh"
                            variant="primary"
                            className={`w-fit ${CTA_MOTION}`}
                        >
                            {t('cta')}
                        </Button>
                    </div>

                    <p className="font-roboto-flex mt-6 max-w-xl text-body-xs text-foreground-inverse-secondary md:text-body-s">
                        {t('disclaimer')}
                    </p>
                </div>

                <div className="flex min-w-0 justify-center md:justify-end">
                    <Link prefetch={false} href="/shhhhh" aria-label={t('cta')} className="inline-block -rotate-12">
                        <div className="aspect-[400/252] w-[min(20rem,72vw)] md:w-[min(25rem,30vw)]">
                            <ScaledPixelatedCardFace last4="????" shadowColor={PINK} />
                        </div>
                    </Link>
                </div>
            </div>
        </section>
    )
}
