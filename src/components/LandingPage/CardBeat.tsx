'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, useReducedMotion } from 'framer-motion'
import posthog from 'posthog-js'
import Star from '@/assets/illustrations/star.svg'
import { Button } from '@/components/0_Bruddle/Button'
import { ScaledPixelatedCardFace } from '@/components/Card/share-asset/ScaledPixelatedCardFace'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { useAuth } from '@/context/authContext'
import type { LandingStrings } from './landingStrings'

// Weekly admission rate for the closed beta (product/card.md). The counter
// starts one above and ticks down once, so the number reads as live.
const ADMISSIONS_PER_WEEK = 50
const COUNTER_START = ADMISSIONS_PER_WEEK + 1

function ScarcityCounter({ label }: { label: string }) {
    const prefersReducedMotion = useReducedMotion()
    const [count, setCount] = useState(COUNTER_START)

    useEffect(() => {
        if (prefersReducedMotion) {
            setCount(ADMISSIONS_PER_WEEK)
            return
        }
        const timer = setTimeout(() => setCount(ADMISSIONS_PER_WEEK), 2500)
        return () => clearTimeout(timer)
    }, [prefersReducedMotion])

    const ticked = count === ADMISSIONS_PER_WEEK

    return (
        <motion.span
            className="mx-1 inline-block whitespace-nowrap bg-n-1 px-2 py-0.5 text-[0.92em] font-extraBlack uppercase tracking-wider text-primary-1"
            animate={ticked && !prefersReducedMotion ? { scale: [1, 1.18, 1] } : {}}
            transition={{ duration: 0.5, ease: 'easeOut' }}
        >
            {/* local interpolation — importing t() from @/i18n would pull every
                locale catalog into this client bundle */}
            {label.replace('{count}', String(count))}
        </motion.span>
    )
}

export function CardBeat({ strings }: { strings: LandingStrings }) {
    const { cardBeat } = strings
    const { user } = useAuth()
    const router = useRouter()

    const handleDoorClick = () => {
        posthog.capture(ANALYTICS_EVENTS.DOOR_TRY, { surface: 'home_card_beat', signed_in: !!user })
        router.push('/shhhhh')
    }

    return (
        <section id="card-beat" className="relative overflow-hidden bg-primary-1 px-4 py-18 text-n-1 md:py-28">
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
                            <ScarcityCounter label={cardBeat.counterLabel} />
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

                        <div className="mt-6 inline-flex items-center rounded-sm border-2 border-n-1 bg-white px-3 py-2 text-[0.6875rem] font-extraBlack uppercase tracking-[0.11em] shadow-[4px_4px_0_#000]">
                            {cardBeat.trust}
                        </div>
                    </div>

                    <div className="flex min-w-0 justify-center md:justify-end">
                        {/* blurAll: closed-beta tease — card shape recognisable, logos +
                            number unreadable. Rotation sits on the wrapper so the inner
                            host still measures its layout width for the fit-to-width scale. */}
                        <div className="-rotate-12">
                            <div className="w-[min(20rem,72vw)] md:w-[min(25rem,30vw)]">
                                <ScaledPixelatedCardFace last4="????" blurAll />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Numerals aren't translatable; the labels beside them are. 150M+
                    leads so it takes the top-left cell of the 2x2 mobile grid. */}
                <div className="mt-8 grid grid-cols-2 gap-3 md:mt-11 md:grid-cols-4 md:gap-4.5">
                    {[
                        { value: '150M+', label: cardBeat.statMerchants },
                        { value: '1', label: cardBeat.statBalance },
                        { value: '1', label: cardBeat.statCard },
                        { value: '0', label: cardBeat.statMonthlyFees },
                    ].map((stat) => (
                        <div
                            key={stat.label}
                            className="rounded-sm border-2 border-n-1 bg-white px-3 py-4.5 text-center shadow-[4px_4px_0_#000]"
                        >
                            <div className="font-roboto-flex-extrabold text-3xl font-extraBlack leading-none md:text-5xl">
                                {stat.value}
                            </div>
                            <div className="font-roboto-flex mt-2 text-[0.6875rem] font-extraBlack uppercase leading-tight tracking-wider">
                                {stat.label}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
}
