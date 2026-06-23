'use client'

import Image from 'next/image'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import posthog from 'posthog-js'
import { Button } from '@/components/0_Bruddle/Button'
import { Marquee } from '@/components/LandingPage'
import { useAuth } from '@/context/authContext'
import { PixelatedCardFace } from '@/components/Card/share-asset/PixelatedCardFace'
import { Sparkle, Star } from '@/assets/illustrations'
import { cardApi } from '@/services/card'
import { invitesApi } from '@/services/invites'
import { saveToCookie, getFromCookie, removeFromCookie } from '@/utils/general.utils'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'

const marqueeMessages = ['IYKYK', 'WORD TRAVELS', 'CLOSED BETA', 'SHHHH', 'PEANUT CLUB']

// /shhhhh?campaign=skip — the Skip Pass link. Awards the WAITLIST_SKIP badge
// (same contract as /invite?campaign=skip) so friends-of-Peanut skip the line.
// A BARE visit grants nothing: the door joins the waitlist, it is not a bypass.
const SKIP_CAMPAIGN = 'skip'

// Inline "you're on the waitlist" confirmation shown in place of the door CTA
// once the user joins (pre-launch, non-skip path). `dark` = on the black §7.
function WaitlistJoined({ position, dark = false }: { position: number | null; dark?: boolean }) {
    return (
        <div className="flex flex-col items-center gap-3 md:items-start">
            <div
                className={`font-roboto-flex-extrabold inline-flex items-center gap-2 border-2 border-n-1 px-6 py-3 text-base font-extraBlack uppercase shadow-[4px_4px_0_#000] md:text-lg ${
                    dark ? 'bg-secondary-1 text-n-1' : 'bg-white text-n-1'
                }`}
            >
                ✓ You&apos;re on the waitlist{typeof position === 'number' ? ` · #${position}` : ''}
            </div>
            <p className={`font-roboto-flex text-sm font-bold ${dark ? 'text-white/90' : ''}`}>
                We&apos;ll holler when your turn comes up.
            </p>
        </div>
    )
}

const stats: Array<{ value: string; label: string }> = [
    { value: '150M+', label: 'Visa-accepting merchants' },
    { value: '1', label: 'balance' },
    { value: '1', label: 'card' },
    { value: '0', label: 'middlemen' },
]

const badges: Array<{ code: string; name: string; src: string }> = [
    { code: 'OG_2025_10_12', name: 'Peanut OG', src: '/badges/og_v1.svg' },
    { code: 'DEVCONNECT_BA_2025', name: 'Devconnect BA', src: '/badges/devconnect_2025.svg' },
    { code: 'ARBIVERSE_DEVCONNECT_BA_2025', name: 'Arbiverse', src: '/badges/arbiverse_devconnect.svg' },
]

const faqQuestions = [
    {
        question: "WHAT'S THE PEANUT CARD?",
        answer: 'A non-custodial card. Top up with stablecoins, then use the card for everyday spending wherever Visa is accepted.',
    },
    {
        question: 'WHERE DOES IT WORK?',
        answer: 'Accepted wherever Visa is accepted — about 150 million merchants. Online, in-store, ATMs.',
    },
    {
        question: 'IS MY MONEY SAFE?',
        answer: "It's yours. Non-custodial — your stablecoins stay in your wallet until the moment you use the card. We don't hold custody. We don't lend it out.",
    },
    {
        question: "WHAT'S THE $10?",
        answer: 'A welcome reward. Complete verification + first $100 in card spend → $10 unlocked to your balance. Same deal whether you signed up yourself or got referred. If you referred someone, you also are eligible for $10 when they activate. Subject to eligibility and program terms.',
    },
    {
        question: 'HOW LONG IS THE WAITLIST?',
        answer: "We're letting in about 20 people a week during closed beta. Order matters. Badges skip the line entirely.",
    },
    {
        question: 'WHERE CAN I GET THE CARD?',
        answer: "We're rolling out to select regions first and adding more as our partners' coverage expands. Eligibility is shown during signup.",
    },
    {
        question: 'ANY FEES?',
        answer: 'No monthly fees. No annual fees. Standard fees and limits apply per the cardholder terms.',
    },
    {
        question: 'WHY "SHHHHH"?',
        answer: "We'd rather under-promise and over-deliver to a small group than blast the whole internet on day one. Word travels.",
    },
]

const ctaButtonClassName =
    '!w-auto bg-white px-7 py-3 text-base font-extrabold hover:bg-white/90 md:px-9 md:py-8 md:text-xl'

function ScarcityCounter() {
    const [count, setCount] = useState(21)
    useEffect(() => {
        const timer = setTimeout(() => setCount(20), 2500)
        return () => clearTimeout(timer)
    }, [])
    return (
        <motion.span
            className="mx-1 inline-block whitespace-nowrap bg-n-1 px-2 py-0.5 text-[0.92em] font-extraBlack uppercase tracking-wider text-primary-1"
            animate={count === 20 ? { scale: [1, 1.18, 1] } : {}}
            transition={{ duration: 0.5, ease: 'easeOut' }}
        >
            only {count}
        </motion.span>
    )
}

function StickyShhhhhCTA({ onClick }: { onClick: () => void }) {
    const [visible, setVisible] = useState(false)
    const rafId = useRef(0)
    const lastVisible = useRef(false)

    useEffect(() => {
        const check = () => {
            const atBottom = window.innerHeight + window.scrollY >= document.body.scrollHeight - 100
            const next = window.scrollY >= 300 && !atBottom
            if (next !== lastVisible.current) {
                lastVisible.current = next
                setVisible(next)
            }
        }
        const onScroll = () => {
            cancelAnimationFrame(rafId.current)
            rafId.current = requestAnimationFrame(check)
        }
        window.addEventListener('scroll', onScroll, { passive: true })
        check()
        return () => {
            window.removeEventListener('scroll', onScroll)
            cancelAnimationFrame(rafId.current)
        }
    }, [])

    return (
        <AnimatePresence>
            {visible && (
                <motion.div
                    initial={{ y: 80, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 80, opacity: 0 }}
                    transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                    className="pointer-events-none fixed bottom-0 left-0 right-0 z-50 border-t-2 border-n-1 bg-white px-4 py-3 md:hidden"
                >
                    <Button
                        variant="purple"
                        shadowSize="4"
                        onClick={onClick}
                        className="pointer-events-auto w-full py-3 text-base font-extrabold"
                    >
                        TRY THE DOOR
                    </Button>
                </motion.div>
            )}
        </AnimatePresence>
    )
}

export default function ShhhhhLandingPage() {
    const { user, fetchUser } = useAuth()
    const router = useRouter()

    // undefined = not joined; number|null = joined (null = joined but BE
    // returned no position). Drives the inline confirmation.
    const [joinedPosition, setJoinedPosition] = useState<number | null | undefined>(undefined)
    const [ctaBusy, setCtaBusy] = useState(false)
    const [joinError, setJoinError] = useState(false)
    const isJoined = joinedPosition !== undefined

    const joinWaitlist = useCallback(async () => {
        setCtaBusy(true)
        setJoinError(false)
        try {
            // The door actually OPENS for users who already hold card access
            // (skip badge / admin grant) — telling them "you're on the
            // waitlist" would be wrong, and joinWaitlist no-ops for them.
            const info = await cardApi.getInfo()
            if (info.hasCardAccess) {
                router.push('/card')
                return
            }
            const res = await cardApi.joinWaitlist()
            posthog.capture(ANALYTICS_EVENTS.CARD_WAITLIST_JOINED, { position: res.position })
            setJoinedPosition(res.position)
        } catch (err) {
            console.error('[shhhhh] joinWaitlist failed:', err)
            setJoinError(true)
        } finally {
            setCtaBusy(false)
        }
    }, [router])

    // Post-signup return: a signed-out door press saved this cookie and routed
    // through signup back to /shhhhh. Now the account exists — finish the join.
    useEffect(() => {
        if (!user) return
        if (getFromCookie('joinWaitlistAfterSignup') !== '1') return
        removeFromCookie('joinWaitlistAfterSignup')
        void joinWaitlist()
    }, [user, joinWaitlist])

    const handleCTA = async () => {
        // /shhhhh?campaign=skip → Skip Pass (awards the badge). A bare press is
        // NOT a bypass — it joins the waitlist (Hugo 2026-06-07). Read the param
        // at click time (client-only) — avoids useSearchParams (which would bail
        // /shhhhh out of static prerendering) and any mount-effect race.
        const isSkipCampaign =
            new URLSearchParams(window.location.search).get('campaign')?.toLowerCase() === SKIP_CAMPAIGN

        posthog.capture(ANALYTICS_EVENTS.DOOR_TRY, {
            signed_in: !!user,
            campaign: isSkipCampaign ? SKIP_CAMPAIGN : null,
        })

        // Skip Pass link → award the badge; the user is in. (The bare door never
        // awards a badge — see below.)
        if (isSkipCampaign) {
            if (!user) {
                // useZeroDev's post-signup `campaignTag` branch awards the badge
                // (awaited inside registration, before setup redirects) — so
                // landing on /card afterwards is race-free.
                saveToCookie('campaignTag', SKIP_CAMPAIGN)
                router.push(`/setup?step=signup&redirect_uri=${encodeURIComponent('/card')}`)
                return
            }
            try {
                await invitesApi.awardBadge(SKIP_CAMPAIGN)
                posthog.capture(ANALYTICS_EVENTS.INVITE_ACCEPTED, { campaign_tag: SKIP_CAMPAIGN })
                await fetchUser()
            } catch (err) {
                console.error('[shhhhh] awardBadge(skip) failed:', err)
            }
            // Straight into the card flow — the badge award just opened both
            // gates BE-side; /home would make them hunt for the card CTA.
            router.push('/card')
            return
        }

        // Bare door → JOIN THE WAITLIST. No flow-early-access stamp, no /card
        // detour, no badge — visiting /shhhhh is not a bypass (Hugo 2026-06-07).
        if (!user) {
            saveToCookie('joinWaitlistAfterSignup', '1')
            router.push(`/setup?redirect_uri=${encodeURIComponent('/shhhhh')}`)
            return
        }
        await joinWaitlist()
    }

    const marqueeProps = { visible: true, message: marqueeMessages }

    return (
        <>
            {/* §1 — Hero (pink) */}
            <section className="relative overflow-hidden bg-primary-1 px-4 py-20 text-n-1 md:py-24">
                <motion.img
                    src={Star.src}
                    alt=""
                    aria-hidden
                    initial={{ opacity: 0, translateY: 20, translateX: 5 }}
                    whileInView={{ opacity: 1, translateY: 0, translateX: 0 }}
                    transition={{ type: 'spring', damping: 5 }}
                    className="pointer-events-none absolute left-[3%] top-[8%] z-10 w-10 md:left-[6%] md:top-[12%] md:w-14"
                />
                <motion.img
                    src={Star.src}
                    alt=""
                    aria-hidden
                    initial={{ opacity: 0, translateY: 28, translateX: -5 }}
                    whileInView={{ opacity: 1, translateY: 0, translateX: 0 }}
                    transition={{ type: 'spring', damping: 5, delay: 0.15 }}
                    className="pointer-events-none absolute bottom-[5%] right-[4%] z-10 w-8 md:bottom-[8%] md:right-[8%] md:w-12"
                />
                <motion.img
                    src={Sparkle.src}
                    alt=""
                    aria-hidden
                    initial={{ opacity: 0, scale: 0.4 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    transition={{ type: 'spring', damping: 8, delay: 0.3 }}
                    className="pointer-events-none absolute right-[12%] top-[10%] z-10 hidden w-8 md:block md:w-10"
                />
                <div className="relative z-20 mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 md:grid-cols-[1.1fr_0.9fr]">
                    <div className="min-w-0 text-center md:text-left">
                        <h1 className="font-roboto-flex-extrabold text-headingMedium font-extraBlack md:text-headingLarge lg:text-[12rem]">
                            shhhhh.
                        </h1>
                        <p className="font-roboto-flex-extrabold mt-6 max-w-xl text-2xl font-extraBlack uppercase md:text-3xl">
                            The peanut card is out. For you. Maybe.
                        </p>
                        <p className="font-roboto-flex mt-6 max-w-xl text-xl leading-relaxed md:text-2xl">
                            A card accepted at over 150 million Visa-accepting merchants. We&apos;re letting beta users
                            in slowly — <ScarcityCounter /> a week. If you&apos;ve got the right badge, you skip the
                            line entirely.
                        </p>
                        {isJoined ? (
                            <div className="mt-8 flex justify-center md:justify-start">
                                <WaitlistJoined position={joinedPosition ?? null} />
                            </div>
                        ) : (
                            <div className="mt-8 flex flex-col items-center gap-5 md:flex-row md:items-center md:gap-6">
                                <div className="relative">
                                    <Button
                                        shadowSize="4"
                                        onClick={handleCTA}
                                        loading={ctaBusy}
                                        disabled={ctaBusy}
                                        className={ctaButtonClassName}
                                    >
                                        TRY THE DOOR
                                    </Button>
                                    <motion.img
                                        src={Sparkle.src}
                                        alt=""
                                        aria-hidden
                                        initial={{ opacity: 0, scale: 0.4, rotate: -30 }}
                                        animate={{ opacity: 1, scale: 1, rotate: 0 }}
                                        transition={{ type: 'spring', damping: 10, delay: 0.6 }}
                                        className="pointer-events-none absolute -right-4 -top-4 w-8 md:-right-5 md:-top-5 md:w-10"
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={handleCTA}
                                    disabled={ctaBusy}
                                    className="font-roboto-flex text-base font-bold underline underline-offset-4 disabled:opacity-50"
                                >
                                    or join the waitlist →
                                </button>
                            </div>
                        )}
                        {joinError && (
                            <p className="font-roboto-flex mt-3 text-center text-sm font-bold text-error md:text-left">
                                Couldn&apos;t join the waitlist — try the door again.
                            </p>
                        )}
                    </div>
                    <div className="flex min-w-0 justify-center md:justify-end">
                        {/* Match ShareAssetD3 pixelation: same PixelatedCardFace component
                            scaled into the hero column. Native dims are 760×479 (shared
                            CARD_W/CARD_H); the inner absolute-positioned layout scales
                            linearly with the transform. Scale 0.526 keeps the on-screen
                            footprint (~400×253) unchanged after the share-asset card was
                            enlarged 620→760, so this hero is unaffected by that change. */}
                        <div
                            className="origin-center -rotate-12"
                            style={{
                                width: 400,
                                height: 252,
                                transform: 'scale(0.526) rotate(-12deg)',
                                transformOrigin: 'center center',
                            }}
                        >
                            {/* blurAll: closed-beta tease — card shape recognisable,
                                logos + number unreadable. */}
                            <PixelatedCardFace last4="0420" blurAll />
                        </div>
                    </div>
                </div>
            </section>

            <Marquee {...marqueeProps} />

            {/* §2 — What it does (yellow) */}
            <section className="relative overflow-hidden bg-secondary-1 px-4 py-24 text-center text-n-1 md:py-32">
                <div className="mx-auto max-w-5xl">
                    <h2 className="font-roboto-flex-extrabold mx-auto max-w-3xl text-heading font-extraBlack uppercase md:text-headingMedium">
                        It&apos;s a card.
                        <br />
                        That&apos;s the whole trick.
                    </h2>
                    <p className="font-roboto-flex mx-auto mt-8 max-w-2xl text-xl leading-relaxed md:text-2xl">
                        Fund the card however you already move money: bank transfer, exchange withdrawal, or stablecoins
                        (USDC, USDT). Your balance is yours. Non-custodial. No monthly fees. No annual fees.
                    </p>
                    <div className="mt-12 flex flex-wrap justify-center gap-3 md:flex-nowrap md:gap-4">
                        {stats.map((stat) => (
                            <div
                                key={stat.label}
                                className="flex basis-[calc(50%_-_0.375rem)] flex-col items-center justify-center rounded-sm border-2 border-n-1 bg-white px-4 py-8 text-center shadow-[4px_4px_0_#000] md:flex-1 md:basis-0 md:py-10"
                            >
                                <div className="font-roboto-flex-extrabold text-5xl font-extraBlack md:text-6xl">
                                    {stat.value}
                                </div>
                                <div className="font-roboto-flex mt-3 text-xs font-bold uppercase tracking-wider md:text-sm">
                                    {stat.label}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <Marquee {...marqueeProps} />

            {/* §3 — Who it's for (PINK) */}
            <section className="relative overflow-hidden bg-primary-1 px-4 py-24 text-n-1 md:py-32">
                <div className="mx-auto max-w-3xl">
                    <h2 className="font-roboto-flex-extrabold text-heading font-extraBlack uppercase md:text-headingMedium">
                        If you live in more than one country, this is for you.
                    </h2>
                    <p className="font-roboto-flex mt-10 text-xl leading-relaxed md:text-2xl">
                        We built peanut for people who don&apos;t fit. Digital nomads who get bounced by every
                        neobank&apos;s verification the moment they cross a border. Expats who pay 4% on every
                        transaction home. Cross-border users who earn in one currency and spend in another.
                    </p>
                </div>
            </section>

            <Marquee {...marqueeProps} />

            {/* §4 — How to get in (blue, 2 doors) */}
            <section
                className="relative overflow-hidden px-4 py-24 text-n-1 md:py-32"
                style={{ backgroundColor: '#90A8ED' }}
            >
                <div className="mx-auto max-w-5xl">
                    <h2 className="font-roboto-flex-extrabold text-center text-heading font-extraBlack uppercase md:text-headingMedium">
                        How to get in.
                    </h2>
                    <p className="font-roboto-flex mt-3 text-center text-xl font-bold md:text-2xl">
                        Cred check. Badge skips the queue.
                    </p>
                    <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8">
                        <div className="rounded-sm border-2 border-n-1 bg-white p-8 shadow-[10px_10px_0_#000] md:p-10">
                            <div
                                className="font-roboto-flex-extrabold text-6xl font-extraBlack text-primary-1"
                                style={{ WebkitTextStroke: '2px #000' }}
                            >
                                01
                            </div>
                            <h3 className="font-roboto-flex-extrabold mt-5 text-3xl font-extraBlack uppercase md:text-4xl">
                                Got a badge.
                            </h3>
                            <p className="font-roboto-flex mt-4 text-base leading-relaxed">
                                You skip the line. We&apos;re whitelisting holders of:
                            </p>
                            <div className="mt-6 grid grid-cols-3 gap-3">
                                {badges.map((b) => (
                                    <div
                                        key={b.code}
                                        className="flex flex-col items-center gap-2 rounded-sm border-2 border-n-1 bg-primary-3 p-3 shadow-[3px_3px_0_#000]"
                                    >
                                        <div className="relative aspect-square w-full">
                                            <Image
                                                src={b.src}
                                                alt={b.name}
                                                fill
                                                className="object-contain"
                                                sizes="(max-width: 768px) 80px, 120px"
                                            />
                                        </div>
                                        <span className="font-roboto-flex text-center text-[0.7rem] font-bold uppercase leading-tight tracking-tight">
                                            {b.name}
                                        </span>
                                    </div>
                                ))}
                            </div>
                            <p className="font-roboto-flex mt-5 text-base leading-relaxed">
                                Sign in, we check the badges on your account, you go straight to verification. No peanut
                                account yet? Sign up first — takes a minute.
                            </p>
                        </div>

                        <div className="rounded-sm border-2 border-n-1 bg-white p-8 shadow-[10px_10px_0_#000] md:p-10">
                            <div
                                className="font-roboto-flex-extrabold text-6xl font-extraBlack text-primary-1"
                                style={{ WebkitTextStroke: '2px #000' }}
                            >
                                02
                            </div>
                            <h3 className="font-roboto-flex-extrabold mt-5 text-3xl font-extraBlack uppercase md:text-4xl">
                                No badge.
                            </h3>
                            <p className="font-roboto-flex mt-4 text-base leading-relaxed">
                                Join the waitlist. We let people in 20 a week.
                            </p>
                            <p className="font-roboto-flex mt-3 text-base leading-relaxed">
                                Put your name on the list and we&apos;ll holler when your turn comes up.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            <Marquee {...marqueeProps} />

            {/* §5 — Probably not for you (BLACK) */}
            <section className="relative overflow-hidden bg-n-1 px-4 py-24 text-white md:py-32">
                <div className="mx-auto max-w-3xl">
                    <h2 className="font-roboto-flex-extrabold text-heading font-extraBlack uppercase md:text-headingMedium">
                        Probably not for you.
                    </h2>
                    <p className="font-roboto-flex mt-8 text-xl leading-relaxed opacity-90 md:text-2xl">
                        If your money lives in one country and one currency, your bank card already works. Keep it.
                    </p>
                    <p className="font-roboto-flex mt-4 text-xl leading-relaxed opacity-90 md:text-2xl">
                        If your money lives elsewhere — across borders, in dollars, in self-custody — the peanut card
                        was built for you.
                    </p>
                </div>
            </section>

            <Marquee {...marqueeProps} />

            {/* §6 — FAQ (cream — inline accordion, no white panel) */}
            <section
                className="relative overflow-hidden px-4 py-24 text-n-1 md:py-32"
                style={{ backgroundColor: '#F9F4F0' }}
            >
                <div className="mx-auto max-w-3xl">
                    <h2 className="font-roboto-flex-extrabold text-heading font-extraBlack uppercase md:text-headingMedium">
                        FAQ.
                    </h2>
                    <div className="mt-10 border-y-2 border-n-1">
                        {faqQuestions.map((q, idx) => (
                            <details
                                key={q.question}
                                className={`group py-5 ${idx > 0 ? 'border-t-2 border-n-1' : ''}`}
                            >
                                <summary className="font-roboto-flex-extrabold flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-extraBlack uppercase md:text-xl [&::-webkit-details-marker]:hidden">
                                    <span>{q.question}</span>
                                    <span className="shrink-0 text-3xl leading-none transition-transform duration-200 group-open:rotate-45">
                                        +
                                    </span>
                                </summary>
                                <p className="mt-4 text-lg font-semibold leading-6 text-n-1 md:text-xl">{q.answer}</p>
                            </details>
                        ))}
                    </div>
                </div>
            </section>

            <Marquee {...marqueeProps} />

            {/* §7 — Ready? (BLACK) */}
            <section className="relative overflow-hidden bg-n-1 px-4 py-32 text-center text-white md:py-40">
                <motion.img
                    src={Sparkle.src}
                    alt=""
                    aria-hidden
                    initial={{ opacity: 0, scale: 0.4, rotate: -30 }}
                    whileInView={{ opacity: 1, scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', damping: 8 }}
                    className="pointer-events-none absolute left-[8%] top-[18%] w-10 md:left-[15%] md:top-[20%] md:w-14"
                />
                <motion.img
                    src={Sparkle.src}
                    alt=""
                    aria-hidden
                    initial={{ opacity: 0, scale: 0.4, rotate: 30 }}
                    whileInView={{ opacity: 1, scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', damping: 8, delay: 0.2 }}
                    className="pointer-events-none absolute bottom-[20%] right-[10%] w-8 md:bottom-[24%] md:right-[18%] md:w-12"
                />
                <div className="relative z-10 mx-auto max-w-3xl">
                    <h2 className="font-roboto-flex-extrabold text-heading font-extraBlack md:text-headingMedium lg:text-headingLarge">
                        ready?
                    </h2>
                    <p className="font-roboto-flex-extrabold mt-6 text-2xl font-extraBlack uppercase md:text-3xl">
                        Try the door.
                    </p>
                    <div className="mt-10 flex justify-center">
                        {isJoined ? (
                            <WaitlistJoined position={joinedPosition ?? null} dark />
                        ) : (
                            <Button
                                shadowSize="4"
                                onClick={handleCTA}
                                loading={ctaBusy}
                                disabled={ctaBusy}
                                className={ctaButtonClassName}
                            >
                                TRY THE DOOR
                            </Button>
                        )}
                    </div>
                    {joinError && (
                        <p className="font-roboto-flex mt-3 text-sm font-bold text-error">
                            Couldn&apos;t join the waitlist — try the door again.
                        </p>
                    )}
                </div>
            </section>

            {!isJoined && <StickyShhhhhCTA onClick={handleCTA} />}
        </>
    )
}
