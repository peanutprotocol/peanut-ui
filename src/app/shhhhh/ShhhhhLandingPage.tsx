'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, MotionConfig } from 'framer-motion'
import posthog from 'posthog-js'
import { useTranslations } from 'next-intl'
import { captureException } from '@sentry/nextjs'
import { Button } from '@/components/0_Bruddle/Button'
import { HeroBackNav } from '@/components/Marketing/HeroBackNav'
import { Marquee } from '@/components/LandingPage/marquee'
import { JsonLd } from '@/components/Marketing/JsonLd'
import { ScaledPixelatedCardFace } from '@/components/Card/share-asset/ScaledPixelatedCardFace'
import { Sparkle, Star } from '@/assets/illustrations'
import { useAuth } from '@/context/authContext'
import { faqSchema } from '@/lib/seo/schemas'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { MIGRATION_SURFACES } from '@/constants/migration.consts'
import { useGuestStoreHandoff } from '@/hooks/useGuestStoreHandoff'
import { badgeCampaignsFromSearchParams, queuePendingBadgeCampaigns } from '@/components/Invites/badge-campaign-context'
import { claimAndSettlePendingBadgeCampaigns, isConfirmedBadgeCampaignClaim } from '@/services/badge-campaigns'
import { queueShhhhhCampaignContinuation, shhhhhCampaignSignupRoute } from './shhhhh-acquisition'

const faqKeys = ['q1', 'q2', 'q3', 'q5', 'q6', 'q7', 'q8'] as const

// "150 million merchants" is on the issuer's allowed acceptance list; the
// other three are product facts. Values are numerals, so they need no locale.
const stats = [
    { value: '150M+', labelKey: 'statMerchants' },
    { value: '1', labelKey: 'statBalance' },
    { value: '0', labelKey: 'statMonthlyFees' },
    { value: '0', labelKey: 'statAnnualFees' },
] as const

const steps = ['signIn', 'verify', 'spend'] as const

const sectionTitleClass = 'font-roboto-flex-extrabold text-heading font-extraBlack uppercase md:text-headingMedium'

/** Keep existing campaign links usable while card applications are public. */
export default function ShhhhhLandingPage() {
    const t = useTranslations('shhhhh')
    const { user, fetchUser, isFetchingUser } = useAuth()
    const router = useRouter()
    const [busy, setBusy] = useState(false)

    // During migration, web guests install the app and continue to /card after signup.
    const { interceptGuestCta, storeHandoffModal } = useGuestStoreHandoff({
        surface: MIGRATION_SURFACES.LANDING_DOOR,
        trackImpressionWhenGuest: !isFetchingUser && !user,
    })

    const handleCTA = async () => {
        // wait for auth so returning users are not sent to signup or the store
        if (busy || isFetchingUser) return
        setBusy(true)
        const campaigns = badgeCampaignsFromSearchParams(new URLSearchParams(window.location.search))
        posthog.capture(ANALYTICS_EVENTS.CARD_APPLICATION_CTA_CLICKED, { signed_in: !!user, campaign_tags: campaigns })
        try {
            // save campaigns before the store handoff: buildDeferredPayload reads this cookie queue
            const queued = campaigns.length > 0 ? queuePendingBadgeCampaigns(campaigns, 30) : []
            if (!user && interceptGuestCta({ dest: '/card' })) return
            if (campaigns.length > 0) {
                if (!user) {
                    queueShhhhhCampaignContinuation()
                    router.push(shhhhhCampaignSignupRoute())
                    return
                }
                try {
                    const batch = await claimAndSettlePendingBadgeCampaigns(queued)
                    const confirmed = batch.claims.filter(isConfirmedBadgeCampaignClaim)
                    if (confirmed.length > 0) {
                        posthog.capture(ANALYTICS_EVENTS.INVITE_ACCEPTED, {
                            campaign_tags: confirmed.map((claim) => claim.badgeCampaign),
                        })
                        await fetchUser()
                    }
                    if (batch.pending.length > 0) {
                        captureException(new Error('Card landing campaign claim retained for retry'), {
                            tags: { error_type: 'campaign_claim_retryable' },
                            extra: { pendingCampaigns: batch.pending, claims: batch.claims },
                        })
                    }
                } catch (error) {
                    captureException(error, { tags: { error_type: 'campaign_claim_unexpected_failure' } })
                }
            }
            // Campaign awards do not decide whether someone can apply for a card.
            router.push(user ? '/card' : `/setup?redirect_uri=${encodeURIComponent('/card')}`)
        } finally {
            setBusy(false)
        }
    }

    // The homepage door marquee already carries these five words, so the strip
    // between sections here says the same thing in the same voice.
    const marqueeWords = [
        t('marquee.peanutCard'),
        t('marquee.contactless'),
        t('marquee.available'),
        t('marquee.online'),
        t('marquee.noMonthlyFee'),
    ]

    // The page is the only card FAQ crawlers see, so mirror the visible copy into FAQPage
    // structured data from the same keys and strings.
    const faqJsonLd = faqSchema(
        faqKeys.map((key) => ({ question: t(`faq.${key}.question`), answer: t(`faq.${key}.answer`) }))
    )

    return (
        // The decorations are pure garnish, so the springs stop for anyone who
        // asked the OS for less motion.
        <MotionConfig reducedMotion="user">
            {faqJsonLd && <JsonLd data={faqJsonLd} />}
            {/* §1 — Hero (pink) */}
            <section className="relative overflow-hidden bg-background-brand px-4 py-20 text-foreground-primary md:py-24">
                <HeroBackNav />
                <motion.img
                    src={Star.src}
                    alt=""
                    aria-hidden
                    initial={{ opacity: 0, translateY: 20, translateX: 5 }}
                    whileInView={{ opacity: 1, translateY: 0, translateX: 0 }}
                    transition={{ type: 'spring', damping: 5 }}
                    className="pointer-events-none absolute top-[8%] left-[3%] z-10 w-10 md:top-[12%] md:left-[6%] md:w-14"
                />
                <motion.img
                    src={Star.src}
                    alt=""
                    aria-hidden
                    initial={{ opacity: 0, translateY: 28, translateX: -5 }}
                    whileInView={{ opacity: 1, translateY: 0, translateX: 0 }}
                    transition={{ type: 'spring', damping: 5, delay: 0.15 }}
                    className="pointer-events-none absolute right-[4%] bottom-[5%] z-10 w-8 md:right-[8%] md:bottom-[8%] md:w-12"
                />
                <motion.img
                    src={Sparkle.src}
                    alt=""
                    aria-hidden
                    initial={{ opacity: 0, scale: 0.4 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    transition={{ type: 'spring', damping: 8, delay: 0.3 }}
                    className="pointer-events-none absolute top-[10%] right-[12%] z-10 hidden w-8 md:block md:w-10"
                />
                <div className="relative z-20 mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 md:grid-cols-2">
                    <div className="min-w-0">
                        {/* The star above sits where the eyebrow starts, so the eyebrow
                            steps right of it on phones. */}
                        <h1>
                            <span className="font-roboto-flex-extrabold block pl-12 text-body-s-semibold tracking-widest uppercase md:pl-0">
                                {t('hero.wordmark')}
                            </span>
                            <span className="font-roboto-flex-extrabold mt-2 block text-headingMedium font-extraBlack md:text-headingLarge">
                                {t('hero.title')}
                            </span>
                        </h1>
                        <p className="font-roboto-flex-extrabold mt-6 max-w-xl text-heading-s uppercase md:text-heading-m">
                            {t('hero.pitch')}
                        </p>
                        <p className="font-roboto-flex mt-6 max-w-xl text-body-l">{t('hero.lead')}</p>
                        <div className="relative mt-8 sm:inline-block">
                            <Button
                                className="sm:w-auto sm:min-w-64 sm:px-10"
                                variant="secondary"
                                shadowSize="4"
                                onClick={handleCTA}
                                loading={busy}
                                disabled={busy}
                            >
                                {t('hero.cta')}
                            </Button>
                            <motion.img
                                src={Sparkle.src}
                                alt=""
                                aria-hidden
                                initial={{ opacity: 0, scale: 0.4, rotate: -30 }}
                                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                                transition={{ type: 'spring', damping: 10, delay: 0.6 }}
                                className="pointer-events-none absolute -top-4 -right-4 w-8 md:-top-5 md:-right-5 md:w-10"
                            />
                        </div>
                    </div>
                    <div className="mx-auto w-full max-w-md">
                        <div className="-rotate-6">
                            <ScaledPixelatedCardFace last4="????" />
                        </div>
                        {/* Legal line sits under the asset, in the size the homepage
                            card fold uses, so the hero sells and the fine print stays fine. */}
                        <p className="font-roboto-flex mt-8 text-body-xs text-foreground-primary/70 md:text-body-s">
                            {t('hero.disclaimer')}
                        </p>
                    </div>
                </div>
            </section>

            <Marquee message={marqueeWords} />

            {/* §2 — What it does (yellow) */}
            <section className="relative overflow-hidden bg-yellow-500 px-4 py-16 text-center text-foreground-primary">
                <div className="mx-auto max-w-5xl">
                    <h2 className={`${sectionTitleClass} mx-auto max-w-3xl`}>
                        {t('whatItDoes.titleLine1')}
                        <br />
                        {t('whatItDoes.titleLine2')}
                    </h2>
                    <p className="font-roboto-flex mx-auto mt-8 max-w-2xl text-left text-body-l md:text-center">
                        {t('whatItDoes.body')}
                    </p>
                    <div className="mt-12 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
                        {stats.map(({ value, labelKey }) => (
                            <div
                                key={labelKey}
                                className="flex flex-col items-center justify-center rounded-sm border-2 border-border-default bg-background-default px-3 py-8 text-center shadow-4 md:py-10"
                            >
                                <div className="font-roboto-flex-extrabold text-heading-l md:text-heading-xl">
                                    {value}
                                </div>
                                <div className="font-roboto-flex mt-3 text-body-xs tracking-wider uppercase md:text-body-s-semibold">
                                    {t(`whatItDoes.${labelKey}`)}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <Marquee message={marqueeWords} />

            {/* §3 — Who it's for (pink) */}
            <section className="relative overflow-hidden bg-background-brand px-4 py-16 text-foreground-primary">
                <motion.img
                    src={Star.src}
                    alt=""
                    aria-hidden
                    initial={{ opacity: 0, translateY: 20 }}
                    whileInView={{ opacity: 1, translateY: 0 }}
                    transition={{ type: 'spring', damping: 5 }}
                    className="pointer-events-none absolute top-[8%] right-[5%] z-10 w-9 md:top-[14%] md:right-[10%] md:w-12"
                />
                <div className="relative z-20 mx-auto max-w-3xl">
                    <h2 className={sectionTitleClass}>{t('whoItsFor.title')}</h2>
                    <p className="font-roboto-flex mt-8 text-body-l">{t('whoItsFor.body')}</p>
                </div>
            </section>

            {/* §4 — Probably not for you (black): the honesty beat pairs with §3,
                so no strip between them. */}
            <section className="relative overflow-hidden bg-gray-950 px-4 py-16 text-white">
                <div className="mx-auto max-w-3xl">
                    <h2 className={sectionTitleClass}>{t('notForYou.title')}</h2>
                    <p className="font-roboto-flex mt-8 text-body-l opacity-90">{t('notForYou.body1')}</p>
                    <p className="font-roboto-flex mt-4 border-t-2 border-white/25 pt-4 text-body-l opacity-90">
                        {t('notForYou.body2')}
                    </p>
                </div>
            </section>

            <Marquee message={marqueeWords} />

            {/* §5 — How to get it (white) */}
            <section className="relative overflow-hidden bg-background-default px-4 py-16 text-foreground-primary">
                <div className="mx-auto max-w-3xl">
                    <h2 className={sectionTitleClass}>{t('howToApply.title')}</h2>
                    <ol className="mt-8 grid gap-4 md:grid-cols-3">
                        {steps.map((step) => (
                            <li
                                key={step}
                                className="rounded-sm border-2 border-border-default bg-background-default px-4 py-4 shadow-4"
                            >
                                <div className="font-roboto-flex-extrabold text-heading-s uppercase">
                                    {t(`howToApply.${step}Title`)}
                                </div>
                                <p className="font-roboto-flex mt-1 text-body-m">{t(`howToApply.${step}Body`)}</p>
                            </li>
                        ))}
                    </ol>
                </div>
            </section>

            <Marquee message={marqueeWords} />

            {/* §6 — FAQ (white) */}
            <section className="bg-background-default px-4 py-16 text-foreground-primary">
                <div className="mx-auto max-w-3xl">
                    <h2 className={sectionTitleClass}>{t('faq.title')}</h2>
                    <div className="mt-10 border-y-2 border-border-default">
                        {faqKeys.map((key, index) => (
                            <details
                                key={key}
                                className={`group py-4 ${index > 0 ? 'border-t-2 border-border-default' : ''}`}
                            >
                                <summary className="font-roboto-flex-extrabold flex cursor-pointer list-none items-center justify-between gap-4 text-heading-card uppercase [&::-webkit-details-marker]:hidden">
                                    <span>{t(`faq.${key}.question`)}</span>
                                    <span aria-hidden className="ml-4 shrink-0 select-none group-open:hidden">
                                        {'+'}
                                    </span>
                                    <span aria-hidden className="ml-4 hidden shrink-0 select-none group-open:inline">
                                        {'−'}
                                    </span>
                                </summary>
                                <p className="mt-4 text-body-l">{t(`faq.${key}.answer`)}</p>
                            </details>
                        ))}
                    </div>
                </div>
            </section>

            <Marquee message={marqueeWords} />

            {/* §7 — Ready? (black) */}
            <section className="relative overflow-hidden bg-gray-950 px-4 py-20 text-center text-white md:py-24">
                <motion.img
                    src={Sparkle.src}
                    alt=""
                    aria-hidden
                    initial={{ opacity: 0, scale: 0.4, rotate: -30 }}
                    whileInView={{ opacity: 1, scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', damping: 8 }}
                    className="pointer-events-none absolute top-[18%] left-[8%] w-10 md:top-[20%] md:left-[15%] md:w-14"
                />
                <motion.img
                    src={Sparkle.src}
                    alt=""
                    aria-hidden
                    initial={{ opacity: 0, scale: 0.4, rotate: 30 }}
                    whileInView={{ opacity: 1, scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', damping: 8, delay: 0.2 }}
                    className="pointer-events-none absolute right-[10%] bottom-[20%] w-8 md:right-[18%] md:bottom-[24%] md:w-12"
                />
                <div className="relative z-10 mx-auto max-w-3xl">
                    <h2 className="font-roboto-flex-extrabold text-heading font-extraBlack uppercase md:text-headingMedium lg:text-headingLarge">
                        {t('ready.title')}
                    </h2>
                    <p className="font-roboto-flex-extrabold mt-6 text-heading-s uppercase md:text-heading-m">
                        {t('ready.subtitle')}
                    </p>
                    {/* Primary here on purpose: the brand fill pops on the black
                        closer, while the hero stays secondary because its background
                        is that same fill. */}
                    <Button
                        className="mx-auto mt-10 sm:w-auto sm:min-w-64 sm:px-10"
                        variant="primary"
                        shadowSize="4"
                        onClick={handleCTA}
                        loading={busy}
                        disabled={busy}
                    >
                        {t('hero.cta')}
                    </Button>
                    <p className="font-roboto-flex mt-6 text-body-xs text-white/60 md:text-body-s">
                        {t('ready.disclaimer')}
                    </p>
                </div>
            </section>
            {storeHandoffModal}
        </MotionConfig>
    )
}
