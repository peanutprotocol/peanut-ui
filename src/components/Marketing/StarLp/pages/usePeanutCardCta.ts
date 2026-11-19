'use client'

import { captureException } from '@sentry/nextjs'
import { useRouter } from 'next/navigation'
import posthog from 'posthog-js'
import { useEffect, useState, type MouseEvent } from 'react'
import { STAR_LP_HREF } from '@/components/Marketing/StarLp/starLp.consts'
import { badgeCampaignsFromSearchParams, queuePendingBadgeCampaigns } from '@/components/Invites/badge-campaign-context'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { MIGRATION_SURFACES } from '@/constants/migration.consts'
import { useOptionalAuth } from '@/context/authContext'
import { cardCampaignSignupRoute, queueCardCampaignContinuation } from '@/features/card/card-campaign-acquisition'
import { useGuestStoreHandoff } from '@/hooks/useGuestStoreHandoff'
import { claimAndSettlePendingBadgeCampaigns, isConfirmedBadgeCampaignClaim } from '@/services/badge-campaigns'
import type { PeanutCardCtaPlacement } from './peanutCard.types'

// The page mounts several CTAs (hero, hero card, close): one claim at a time across all of them.
let claimInFlight = false

/**
 * The card CTA's routing, shared by the buttons and the hero card: signed-in
 * visitors go straight to /card; guests get the store (or the desktop QR
 * modal) with /card as the deferred destination. The guest href is the
 * fallback when the hand-off does not take the click. A click while auth is still
 * loading is queued and runs when it settles, so a returning user is not sent
 * to the store and a tap is never dead. Render `storeHandoffModal` beside the link.
 *
 * Badge-campaign links (?badge_campaign=, ?campaign=) used to land on /shhhhh,
 * which now redirects here with its query. The campaign is queued before the
 * store hand-off (the deferred payload reads that queue) and claimed for a
 * signed-in visitor. A campaign never decides whether someone can apply.
 */
export function usePeanutCardCta(placement: PeanutCardCtaPlacement) {
    const router = useRouter()
    // /peanut-card renders on the app tree (see marketing-routes.ts), so auth
    // is real there. Without an AuthProvider every visitor is a guest and
    // never waits on auth.
    const auth = useOptionalAuth()
    const user = auth?.user ?? null
    const isFetchingUser = auth?.isFetchingUser ?? false
    const { interceptGuestCta, storeHandoffModal } = useGuestStoreHandoff({
        surface: MIGRATION_SURFACES.STAR_LP,
        trackImpressionWhenGuest: placement === 'hero' && !isFetchingUser && !user,
    })
    const [queued, setQueued] = useState(false)
    const [claiming, setClaiming] = useState(false)
    const href = user ? STAR_LP_HREF.cardSignedIn : STAR_LP_HREF.cardGuest

    const claimThenOpenCard = async (campaigns: string[]) => {
        claimInFlight = true
        setClaiming(true)
        try {
            const batch = await claimAndSettlePendingBadgeCampaigns(campaigns)
            const confirmed = batch.claims.filter(isConfirmedBadgeCampaignClaim)
            if (confirmed.length > 0) {
                posthog.capture(ANALYTICS_EVENTS.INVITE_ACCEPTED, {
                    campaign_tags: confirmed.map((claim) => claim.badgeCampaign),
                })
                await auth?.fetchUser()
            }
            if (batch.pending.length > 0) {
                captureException(new Error('Card landing campaign claim retained for retry'), {
                    tags: { error_type: 'campaign_claim_retryable' },
                    extra: { pendingCampaigns: batch.pending, claims: batch.claims },
                })
            }
        } catch (error) {
            captureException(error, { tags: { error_type: 'campaign_claim_unexpected_failure' } })
        } finally {
            claimInFlight = false
            setClaiming(false)
            router.push(STAR_LP_HREF.cardSignedIn)
        }
    }

    // Returns true when the click was handled here and the link must not navigate.
    const go = (): boolean => {
        if (claimInFlight) return true
        const campaigns = badgeCampaignsFromSearchParams(new URLSearchParams(window.location.search))
        posthog.capture(ANALYTICS_EVENTS.CARD_APPLICATION_CTA_CLICKED, {
            signed_in: !!user,
            surface: MIGRATION_SURFACES.STAR_LP,
            placement,
            campaign_tags: campaigns,
        })
        // Queue before the store hand-off: buildDeferredPayload reads this cookie queue.
        const queuedCampaigns = campaigns.length > 0 ? queuePendingBadgeCampaigns(campaigns, 30) : []
        if (!user) {
            if (interceptGuestCta({ dest: '/card' })) return true
            if (campaigns.length === 0) return false
            queueCardCampaignContinuation()
            router.push(cardCampaignSignupRoute())
            return true
        }
        if (queuedCampaigns.length === 0) return false
        void claimThenOpenCard(queuedCampaigns)
        return true
    }

    useEffect(() => {
        if (!queued || isFetchingUser) return
        setQueued(false)
        if (!go()) router.push(href)
        // `go` and `href` are read fresh on the render where auth settles.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [queued, isFetchingUser])

    const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
        if (isFetchingUser) {
            event.preventDefault()
            setQueued(true)
            return
        }
        if (go()) event.preventDefault()
    }

    return { href, onClick, queued: queued || claiming, storeHandoffModal }
}
