'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import posthog from 'posthog-js'
import { useTranslations } from 'next-intl'
import { captureException } from '@sentry/nextjs'
import { Button } from '@/components/0_Bruddle/Button'
import { HeroBackNav } from '@/components/Marketing/HeroBackNav'
import { ScaledPixelatedCardFace } from '@/components/Card/share-asset/ScaledPixelatedCardFace'
import { useAuth } from '@/context/authContext'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { MIGRATION_SURFACES } from '@/constants/migration.consts'
import { useGuestStoreHandoff } from '@/hooks/useGuestStoreHandoff'
import { badgeCampaignsFromSearchParams, queuePendingBadgeCampaigns } from '@/components/Invites/badge-campaign-context'
import { claimAndSettlePendingBadgeCampaigns, isConfirmedBadgeCampaignClaim } from '@/services/badge-campaigns'
import { queueShhhhhCampaignContinuation, shhhhhCampaignSignupRoute } from './shhhhh-acquisition'

const faqKeys = ['q1', 'q2', 'q3', 'q5', 'q6', 'q7', 'q8'] as const

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

    return (
        <>
            <section className="relative overflow-hidden bg-primary-1 px-4 py-20 text-n-1 md:py-24">
                <HeroBackNav />
                <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 md:grid-cols-2">
                    <div className="min-w-0">
                        <h1 className="font-roboto-flex-extrabold text-headingMedium font-extraBlack md:text-headingLarge">
                            {t('hero.wordmark')}
                        </h1>
                        <p className="font-roboto-flex-extrabold mt-6 text-2xl font-extraBlack md:text-3xl">
                            {t('hero.tagline')}
                        </p>
                        <p className="font-roboto-flex mt-6 text-xl leading-relaxed">{t('hero.body')}</p>
                        <Button
                            className="mt-8"
                            variant="purple"
                            shadowSize="4"
                            onClick={handleCTA}
                            loading={busy}
                            disabled={busy}
                        >
                            {t('hero.cta')}
                        </Button>
                        <p className="mt-6 text-sm leading-relaxed">{t('hero.disclaimer')}</p>
                    </div>
                    <div className="mx-auto w-full max-w-md -rotate-6">
                        <ScaledPixelatedCardFace last4="????" />
                    </div>
                </div>
            </section>
            <section className="bg-secondary-1 px-4 py-20 text-n-1">
                <div className="mx-auto max-w-3xl">
                    <h2 className="font-roboto-flex-extrabold text-heading font-extraBlack md:text-headingMedium">
                        {t('whatItDoes.titleLine1')} {t('whatItDoes.titleLine2')}
                    </h2>
                    <p className="mt-6 text-xl leading-relaxed">{t('whatItDoes.body')}</p>
                    <h3 className="font-roboto-flex-extrabold mt-12 text-2xl font-extraBlack">
                        {t('howToApply.title')}
                    </h3>
                    <ol className="space-y-4 mt-6 list-decimal pl-6 text-lg">
                        <li>{t('howToApply.verify')}</li>
                        <li>{t('howToApply.terms')}</li>
                        <li>{t('howToApply.spend')}</li>
                    </ol>
                </div>
            </section>
            <section className="bg-background-default px-4 py-20 text-foreground-primary">
                <div className="mx-auto max-w-3xl">
                    <h2 className="font-roboto-flex-extrabold text-heading font-extraBlack md:text-headingMedium">
                        {t('faq.title')}
                    </h2>
                    <div className="mt-10 border-y-2 border-n-1">
                        {faqKeys.map((key, index) => (
                            <details key={key} className={`py-5 ${index > 0 ? 'border-t-2 border-n-1' : ''}`}>
                                <summary className="cursor-pointer text-lg font-bold">
                                    {t(`faq.${key}.question`)}
                                </summary>
                                <p className="mt-4 text-lg leading-relaxed">{t(`faq.${key}.answer`)}</p>
                            </details>
                        ))}
                    </div>
                </div>
            </section>
            <section className="bg-n-1 px-4 py-20 text-center text-white">
                <h2 className="font-roboto-flex-extrabold text-heading font-extraBlack md:text-headingMedium">
                    {t('ready.title')}
                </h2>
                <p className="mt-6 text-xl">{t('ready.subtitle')}</p>
                <Button
                    className="mx-auto mt-8"
                    variant="purple"
                    shadowSize="4"
                    onClick={handleCTA}
                    loading={busy}
                    disabled={busy}
                >
                    {t('hero.cta')}
                </Button>
            </section>
            {storeHandoffModal}
        </>
    )
}
