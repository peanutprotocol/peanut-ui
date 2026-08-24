'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'

// The card face renders nothing on the server and rasterises four canvases on
// mount, so it stays out of the first chunk. The host box reserves the aspect
// ratio, which keeps the fold from shifting when the chunk lands.
const ScaledPixelatedCardFace = dynamic(
    () => import('@/components/Card/share-asset/ScaledPixelatedCardFace').then((m) => m.ScaledPixelatedCardFace),
    { ssr: false }
)

// On a black ground a black drop shadow is invisible, so the card and the
// button both carry brand pink here. Deliberate deviation from the
// all-black-shadow rule, and it applies on this fold only. The button repeats
// the hex in its class because Tailwind only sees literals.
const PINK = '#FF90E8'

/**
 * The homepage door to /shhhhh: wordmark, tagline, the door itself, the card.
 * Every click here goes to /shhhhh — the fold makes the offer and the page
 * does the work (the pitch, the scarcity count, sign-in, badge check, waitlist).
 */
export function ShhhhhFold() {
    const t = useTranslations('shhhhh.hero')

    return (
        <section id="the-door" className="relative overflow-hidden bg-n-1 px-4 py-20 text-white md:py-28">
            <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-9 md:grid-cols-[1.1fr_0.9fr] md:gap-13">
                <div className="min-w-0">
                    <Link
                        prefetch={false}
                        href="/shhhhh"
                        className="font-roboto-flex-extrabold inline-block text-headingMedium font-extraBlack leading-none md:text-headingLarge"
                    >
                        {t('wordmark')}
                    </Link>

                    <p className="font-roboto-flex-extrabold mt-5 max-w-xl text-2xl font-extraBlack uppercase leading-tight md:text-3xl">
                        {t('tagline')}
                    </p>

                    <div className="mt-8 flex flex-wrap items-center gap-5 md:gap-6">
                        <Link prefetch={false} href="/shhhhh">
                            {/* no shadowSize: that prop only paints black. The pink
                                shadow is an arbitrary class so the base
                                `active:shadow-none` still flattens it on press. */}
                            <Button className="!w-auto bg-white px-7 py-3 text-base font-extrabold shadow-[0.25rem_0.25rem_0_#FF90E8] hover:bg-white/90 active:translate-y-[4px] md:px-9 md:text-lg">
                                {t('tryTheDoor')}
                            </Button>
                        </Link>
                        <Link
                            prefetch={false}
                            href="/shhhhh"
                            className="font-roboto-flex text-base font-extraBlack underline underline-offset-4"
                        >
                            {t('orJoinWaitlist')}
                        </Link>
                    </div>

                    <p className="font-roboto-flex mt-6 max-w-xl text-xs leading-relaxed text-white/60 md:text-sm">
                        {t('disclaimer')}
                    </p>
                </div>

                <div className="flex min-w-0 justify-center md:justify-end">
                    {/* blurAll: closed-beta tease — card shape recognisable, logos +
                        number unreadable. Rotation sits on the wrapper so the inner
                        host still measures its layout width for the fit-to-width scale. */}
                    <Link
                        prefetch={false}
                        href="/shhhhh"
                        aria-label={t('tryTheDoor')}
                        className="inline-block -rotate-12"
                    >
                        <div className="aspect-[400/252] w-[min(20rem,72vw)] md:w-[min(25rem,30vw)]">
                            <ScaledPixelatedCardFace last4="????" blurAll shadowColor={PINK} />
                        </div>
                    </Link>
                </div>
            </div>
        </section>
    )
}
