'use client'

import Image from 'next/image'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import posthog from 'posthog-js'
import Star from '@/assets/illustrations/star.svg'
import { Button } from '@/components/0_Bruddle/Button'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { useAuth } from '@/context/authContext'
import { ScarcityCounter } from './ScarcityCounter'
import type { LandingStrings } from './landingStrings'

// The card face renders nothing on the server and rasterises four canvases on
// mount, so it stays out of the first chunk. The host box reserves the
// aspect ratio, which keeps the beat from shifting when the chunk lands.
const ScaledPixelatedCardFace = dynamic(
    () => import('@/components/Card/share-asset/ScaledPixelatedCardFace').then((m) => m.ScaledPixelatedCardFace),
    { ssr: false }
)

// Stat tiles are positional, so they carry literal ids — a translated label
// changing must not change React's key.
const CARD_BEAT_STATS = ['merchants', 'balance', 'card', 'monthlyFees'] as const

export function CardBeat({ strings }: { strings: LandingStrings }) {
    const { cardBeat } = strings
    const { user } = useAuth()
    const router = useRouter()

    // Numerals aren't translatable; the labels beside them are.
    const stats = {
        merchants: { value: '150M+', label: cardBeat.statMerchants },
        balance: { value: '1', label: cardBeat.statBalance },
        card: { value: '1', label: cardBeat.statCard },
        monthlyFees: { value: '0', label: cardBeat.statMonthlyFees },
    }

    const handleDoorClick = () => {
        posthog.capture(ANALYTICS_EVENTS.DOOR_TRY, { surface: 'home_card_beat', signed_in: !!user })
        router.push('/shhhhh')
    }

    return (
        <section
            id="card-beat"
            data-own-cta
            className="relative overflow-hidden bg-primary-1 px-4 py-18 text-n-1 md:py-28"
        >
            <Image
                src={Star}
                alt=""
                aria-hidden
                width={40}
                height={40}
                className="pointer-events-none absolute left-[5%] top-10 z-1 w-8 md:w-10"
            />
            <Image
                src={Star}
                alt=""
                aria-hidden
                width={32}
                height={32}
                className="pointer-events-none absolute bottom-9 right-[6%] z-1 w-6 md:w-8"
            />

            <div className="relative z-2 mx-auto max-w-6xl">
                <div className="grid grid-cols-1 items-center gap-9 md:grid-cols-[1.1fr_0.9fr] md:gap-13">
                    <div className="min-w-0">
                        <p className="font-roboto-flex max-w-[46ch] text-lg font-bold leading-snug md:text-xl">
                            {cardBeat.bridgeBefore}
                            <Link href="/setup" className="font-extraBlack underline underline-offset-4">
                                {cardBeat.bridgeLinkLabel}
                            </Link>
                            {cardBeat.bridgeAfter}
                        </p>

                        <span className="mt-4 inline-flex items-center gap-2 rounded-sm border-2 border-n-1 bg-n-1 px-2.5 py-1.5 text-[0.6875rem] font-extraBlack uppercase tracking-[0.16em] text-white">
                            {cardBeat.kicker}
                        </span>

                        <h2 className="font-roboto-flex-extrabold mt-4 text-4xl font-extraBlack uppercase md:text-heading">
                            {cardBeat.heading}
                        </h2>
                        <p className="font-roboto-flex-extrabold mt-2.5 text-2xl font-extraBlack md:text-4xl">
                            {cardBeat.tagline}
                        </p>

                        <p className="font-roboto-flex mt-4 max-w-[46ch] text-lg leading-relaxed">
                            {cardBeat.bodyBefore}
                            {/* local interpolation — importing t() from @/i18n would
                                pull every locale catalog into this client bundle */}
                            <ScarcityCounter
                                label={(count) => cardBeat.counterLabel.replace('{count}', String(count))}
                            />
                            {cardBeat.bodyAfter}
                        </p>
                        <p className="font-roboto-flex mt-4 max-w-[46ch] text-lg leading-relaxed">{cardBeat.custody}</p>

                        <div className="mt-7 flex flex-wrap items-center gap-4.5">
                            <Button
                                shadowSize="4"
                                onClick={handleDoorClick}
                                className="!w-auto bg-white px-7 py-3 text-base font-extrabold hover:bg-white/90 md:px-9 md:text-lg"
                            >
                                {strings.tryTheDoor}
                            </Button>
                            {/* A plain link, not a second door: DOOR_TRY marks an
                                attempt at the door, so the waitlist route must not
                                fire it or the event stops meaning one thing. */}
                            <Link
                                href="/shhhhh"
                                className="font-roboto-flex text-base font-extraBlack underline underline-offset-4"
                            >
                                {cardBeat.waitlistLink}
                            </Link>
                        </div>

                        <div className="shadow-4 mt-6 inline-flex items-center rounded-sm border-2 border-n-1 bg-white px-3 py-2 text-[0.6875rem] font-extraBlack uppercase tracking-[0.11em]">
                            {cardBeat.trust}
                        </div>
                    </div>

                    <div className="flex min-w-0 justify-center md:justify-end">
                        {/* blurAll: closed-beta tease — card shape recognisable, logos +
                            number unreadable. Rotation sits on the wrapper so the inner
                            host still measures its layout width for the fit-to-width scale. */}
                        <div className="-rotate-12">
                            <div className="aspect-[400/252] w-[min(20rem,72vw)] md:w-[min(25rem,30vw)]">
                                <ScaledPixelatedCardFace last4="????" blurAll />
                            </div>
                        </div>
                    </div>
                </div>

                {/* 150M+ leads so it takes the top-left cell of the 2x2 mobile grid. */}
                <div className="mt-8 grid grid-cols-2 gap-3 md:mt-11 md:grid-cols-4 md:gap-4.5">
                    {CARD_BEAT_STATS.map((id) => (
                        <div
                            key={id}
                            className="shadow-4 rounded-sm border-2 border-n-1 bg-white px-3 py-4.5 text-center"
                        >
                            <div className="font-roboto-flex-extrabold text-3xl font-extraBlack leading-none md:text-5xl">
                                {stats[id].value}
                            </div>
                            <div className="font-roboto-flex mt-2 text-[0.6875rem] font-extraBlack uppercase leading-tight tracking-wider">
                                {stats[id].label}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
}
