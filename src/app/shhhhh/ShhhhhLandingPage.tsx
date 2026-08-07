'use client'

import Image from 'next/image'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import posthog from 'posthog-js'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import { Marquee } from '@/components/LandingPage'
import { useAuth } from '@/context/authContext'
import { PixelatedCardFace } from '@/components/Card/share-asset/PixelatedCardFace'
import { inflateWaitlistPosition } from '@/components/Card/doorTally.utils'
import { Sparkle, Star } from '@/assets/illustrations'
import { cardApi } from '@/services/card'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { badgeCampaignsFromSearchParams, queuePendingBadgeCampaigns } from '@/components/Invites/badge-campaign-context'
import { claimAndSettlePendingBadgeCampaigns, isConfirmedBadgeCampaignClaim } from '@/services/badge-campaigns'
import { captureException } from '@sentry/nextjs'
import {
    destinationForShhhhhClaims,
    queueShhhhhCampaignContinuation,
    shhhhhCampaignSignupRoute,
} from './shhhhh-acquisition'

// Inline "you're on the waitlist" confirmation shown in place of the door CTA
// once the user joins (pre-launch, non-skip path). `dark` = on the black §7.
function WaitlistJoined({
    position,
    dark = false,
    onClick,
}: {
    position: number | null
    dark?: boolean
    onClick?: () => void
}) {
    const t = useTranslations('shhhhh.waitlist')
    return (
        <div className="flex flex-col items-center gap-3 md:items-start">
            <button
                type="button"
                onClick={onClick}
                className={`font-roboto-flex-extrabold inline-flex items-center gap-2 border-2 border-n-1 px-6 py-3 text-base font-extraBlack uppercase shadow-[4px_4px_0_#000] transition-transform hover:-translate-y-0.5 md:text-lg ${
                    dark ? 'bg-secondary-1 text-n-1' : 'bg-white text-n-1'
                }`}
            >
                {typeof position === 'number'
                    ? t('joinedWithPosition', { position: inflateWaitlistPosition(position) })
                    : t('joined')}
            </button>
            <p className={`font-roboto-flex text-sm font-bold ${dark ? 'text-white/90' : ''}`}>{t('holler')}</p>
        </div>
    )
}

// Values are numerals (not translatable); labels come from the catalog.
const statValues = ['150M+', '1', '1', '0'] as const
const statLabelKeys = ['statMerchants', 'statBalance', 'statCard', 'statMiddlemen'] as const

const faqKeys = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8'] as const

const badges: Array<{ code: string; name: string; src: string }> = [
    { code: 'OG_2025_10_12', name: 'Peanut OG', src: '/badges/og_v1.svg' },
    { code: 'DEVCONNECT_BA_2025', name: 'Devconnect BA', src: '/badges/devconnect_2025.svg' },
    { code: 'ARBIVERSE_DEVCONNECT_BA_2025', name: 'Arbiverse', src: '/badges/arbiverse_devconnect.svg' },
]

const ctaButtonClassName =
    '!w-auto bg-white px-7 py-3 text-base font-extrabold hover:bg-white/90 md:px-9 md:py-8 md:text-xl'

function ScarcityCounter() {
    const t = useTranslations('shhhhh.hero')
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
            {t('onlyCount', { count })}
        </motion.span>
    )
}

function StickyShhhhhCTA({ onClick }: { onClick: () => void }) {
    const t = useTranslations('shhhhh.hero')
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
                        {t('tryTheDoor')}
                    </Button>
                </motion.div>
            )}
        </AnimatePresence>
    )
}

export default function ShhhhhLandingPage() {
    const t = useTranslations('shhhhh')
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
            // The door OPENS to /card for access-holders (skip badge / admin
            // grant) AND, post-launch, for everyone: /card runs the press-and-hold
            // eligibility moment → the celebration (access) or the Berghain "not
            // tonight" rejection (no access), and that rejection screen is where a
            // no-access user joins the waitlist. Only PRE-launch (when /card 404s
            // for no-access users) do we join inline here.
            const info = await cardApi.getInfo()
            if (info.hasCardAccess || info.isPublicLaunched) {
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

    // On mount (signed in), reflect existing waitlist membership: a returning
    // user who already joined sees the inline "you're on the waitlist" pill
    // instead of the door. New / not-joined users keep the door, which routes to
    // /card for the Berghain moment (see handleCTA) rather than joining inline.
    useEffect(() => {
        if (!user) return
        let cancelled = false
        void cardApi
            .getInfo()
            .then((info) => {
                if (!cancelled && info.waitlistJoinedAt) setJoinedPosition(info.waitlistPosition)
            })
            .catch(() => {})
        return () => {
            cancelled = true
        }
    }, [user])

    const handleCTA = async () => {
        // Read opaque campaign identities at click time (client-only) to avoid
        // bailing static prerendering. The backend resolves award semantics;
        // provenance is audit-only and does not weaken an earned skip badge.
        const badgeCampaigns = badgeCampaignsFromSearchParams(new URLSearchParams(window.location.search))

        posthog.capture(ANALYTICS_EVENTS.DOOR_TRY, {
            signed_in: !!user,
            campaign_tags: badgeCampaigns,
        })

        if (badgeCampaigns.length > 0) {
            const queuedBadgeCampaigns = queuePendingBadgeCampaigns(badgeCampaigns, 30)
            if (!user) {
                queueShhhhhCampaignContinuation()
                router.push(shhhhhCampaignSignupRoute())
                return
            }

            let destination: '/card' | '/home' = '/home'
            try {
                const batch = await claimAndSettlePendingBadgeCampaigns(queuedBadgeCampaigns)
                const confirmed = batch.claims.filter(isConfirmedBadgeCampaignClaim)
                destination = destinationForShhhhhClaims(batch.claims)
                if (confirmed.length > 0) {
                    posthog.capture(ANALYTICS_EVENTS.INVITE_ACCEPTED, {
                        campaign_tags: confirmed.map((claim) => claim.badgeCampaign),
                    })
                    await fetchUser()
                }
                if (batch.pending.length > 0) {
                    captureException(new Error('shhhhh campaign claim retained for retry'), {
                        tags: { error_type: 'campaign_claim_retryable' },
                        extra: { pendingCampaigns: batch.pending, claims: batch.claims },
                    })
                }
            } catch (error) {
                captureException(error, { tags: { error_type: 'campaign_claim_unexpected_failure' } })
            }

            // Only a confirmed Skip Pass continues to the card flow. Unknown,
            // inactive, expired, malformed, and retryable claims fall back home.
            router.push(destination)
            return
        }

        // Bare door, signed-out → sign up, then land on /card: post-launch the
        // press-and-hold eligibility → Berghain "not tonight" rejection IS the
        // join moment (no inline auto-join, no flow-early-access stamp — still not
        // a bypass; /card does the real gating). Signed-in users route via
        // joinWaitlist() above, which sends them to /card too post-launch.
        if (!user) {
            router.push(`/setup?redirect_uri=${encodeURIComponent('/card')}`)
            return
        }
        await joinWaitlist()
    }

    const marqueeProps = {
        visible: true,
        message: [
            t('marquee.iykyk'),
            t('marquee.wordTravels'),
            t('marquee.closedBeta'),
            t('marquee.shhhh'),
            t('marquee.peanutClub'),
        ],
    }

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
                            {t('hero.wordmark')}
                        </h1>
                        <p className="font-roboto-flex-extrabold mt-6 max-w-xl text-2xl font-extraBlack uppercase md:text-3xl">
                            {t('hero.tagline')}
                        </p>
                        <p className="font-roboto-flex mt-6 max-w-xl text-xl leading-relaxed md:text-2xl">
                            {t.rich('hero.body', { counter: () => <ScarcityCounter /> })}
                        </p>
                        {isJoined ? (
                            <div className="mt-8 flex justify-center md:justify-start">
                                <WaitlistJoined
                                    position={joinedPosition ?? null}
                                    onClick={() => router.push('/card')}
                                />
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
                                        {t('hero.tryTheDoor')}
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
                                    {t('hero.orJoinWaitlist')}
                                </button>
                            </div>
                        )}
                        {joinError && (
                            <p className="font-roboto-flex mt-3 text-center text-sm font-bold text-error md:text-left">
                                {t('hero.joinError')}
                            </p>
                        )}
                    </div>
                    <div className="flex min-w-0 justify-center pb-16 md:justify-end md:pb-0">
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
                        {t('whatItDoes.titleLine1')}
                        <br />
                        {t('whatItDoes.titleLine2')}
                    </h2>
                    <p className="font-roboto-flex mx-auto mt-8 max-w-2xl text-xl leading-relaxed md:text-2xl">
                        {t('whatItDoes.body')}
                    </p>
                    <div className="mt-12 flex flex-wrap justify-center gap-3 md:flex-nowrap md:gap-4">
                        {statLabelKeys.map((labelKey, i) => (
                            <div
                                key={labelKey}
                                className="flex basis-[calc(50%_-_0.375rem)] flex-col items-center justify-center rounded-sm border-2 border-n-1 bg-white px-4 py-8 text-center shadow-[4px_4px_0_#000] md:flex-1 md:basis-0 md:py-10"
                            >
                                <div className="font-roboto-flex-extrabold text-5xl font-extraBlack md:text-6xl">
                                    {statValues[i]}
                                </div>
                                <div className="font-roboto-flex mt-3 text-xs font-bold uppercase tracking-wider md:text-sm">
                                    {t(`whatItDoes.${labelKey}`)}
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
                        {t('whoItsFor.title')}
                    </h2>
                    <p className="font-roboto-flex mt-10 text-xl leading-relaxed md:text-2xl">{t('whoItsFor.body')}</p>
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
                        {t('howToGetIn.title')}
                    </h2>
                    <p className="font-roboto-flex mt-3 text-center text-xl font-bold md:text-2xl">
                        {t('howToGetIn.subtitle')}
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
                                {t('howToGetIn.badgeTitle')}
                            </h3>
                            <p className="font-roboto-flex mt-4 text-base leading-relaxed">
                                {t('howToGetIn.badgeBody')}
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
                                {t('howToGetIn.badgeFooter')}
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
                                {t('howToGetIn.noBadgeTitle')}
                            </h3>
                            <p className="font-roboto-flex mt-4 text-base leading-relaxed">
                                {t('howToGetIn.noBadgeBody')}
                            </p>
                            <p className="font-roboto-flex mt-3 text-base leading-relaxed">
                                {t('howToGetIn.noBadgeFooter')}
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
                        {t('notForYou.title')}
                    </h2>
                    <p className="font-roboto-flex mt-8 text-xl leading-relaxed opacity-90 md:text-2xl">
                        {t('notForYou.body1')}
                    </p>
                    <p className="font-roboto-flex mt-4 text-xl leading-relaxed opacity-90 md:text-2xl">
                        {t('notForYou.body2')}
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
                        {t('faq.title')}
                    </h2>
                    <div className="mt-10 border-y-2 border-n-1">
                        {faqKeys.map((key, idx) => (
                            <details key={key} className={`group py-5 ${idx > 0 ? 'border-t-2 border-n-1' : ''}`}>
                                <summary className="font-roboto-flex-extrabold flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-extraBlack uppercase md:text-xl [&::-webkit-details-marker]:hidden">
                                    <span>{t(`faq.${key}.question`)}</span>
                                    <span className="shrink-0 text-3xl leading-none transition-transform duration-200 group-open:rotate-45">
                                        +
                                    </span>
                                </summary>
                                <p className="mt-4 text-lg font-semibold leading-6 text-n-1 md:text-xl">
                                    {t(`faq.${key}.answer`)}
                                </p>
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
                        {t('ready.title')}
                    </h2>
                    <p className="font-roboto-flex-extrabold mt-6 text-2xl font-extraBlack uppercase md:text-3xl">
                        {t('ready.subtitle')}
                    </p>
                    <div className="mt-10 flex justify-center">
                        {isJoined ? (
                            <WaitlistJoined
                                position={joinedPosition ?? null}
                                dark
                                onClick={() => router.push('/card')}
                            />
                        ) : (
                            <Button
                                shadowSize="4"
                                onClick={handleCTA}
                                loading={ctaBusy}
                                disabled={ctaBusy}
                                className={ctaButtonClassName}
                            >
                                {t('hero.tryTheDoor')}
                            </Button>
                        )}
                    </div>
                    {joinError && (
                        <p className="font-roboto-flex mt-3 text-sm font-bold text-error">{t('hero.joinError')}</p>
                    )}
                </div>
            </section>

            {!isJoined && <StickyShhhhhCTA onClick={handleCTA} />}
        </>
    )
}
