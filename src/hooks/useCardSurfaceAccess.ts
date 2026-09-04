'use client'

import { findActiveCard } from '@/components/Card/cardState.utils'
import { useCardInfo } from '@/hooks/useCardInfo'
import { useRainCardOverview } from '@/hooks/useRainCardOverview'
import { useResidenceRestrictions } from '@/hooks/useResidenceRestrictions'

export interface CardSurfaceAccess {
    /** Rain has issued this user a card that is not canceled. */
    hasIssuedCard: boolean
    /**
     * The user already has a card relationship — an issued card OR an
     * application in flight. `/card` renders application state (rejected,
     * requires-info, pending, manual-review) ABOVE its geo/eligibility gates,
     * so these users must keep a way back to it however restricted their
     * residence is.
     */
    hasCardRelationship: boolean
    /**
     * `/card`'s inner gate — past the waitlist, NOT a card holder. Decides
     * which door the card surface opens (`/card` vs `/shhhhh`), never whether
     * the surface exists.
     */
    hasCardAccess: boolean | undefined
    /** Whether a card surface (profile row, bottom-nav tab) should be offered. */
    showCardSurface: boolean
    /**
     * Where a card surface points. `/card` notFound()s a user with no
     * flowEarlyAccess stamp, so only an existing relationship or the waitlist
     * gate goes there; everyone else lands on /shhhhh, the canonical door.
     */
    cardHref: '/card' | '/shhhhh'
}

/**
 * Whether this user should be offered a card surface at all.
 *
 * Holders always keep theirs; for everyone else the offer only makes sense
 * when the card is attainable — a Rain-prohibited residence or a server "not
 * eligible" hides it instead of advertising a closed door.
 *
 * "Holder" is an ISSUED card or an application in flight, deliberately NOT `hasCardAccess`.
 * That flag is the waitlist's inner gate (`cardAccessGrantedAt` or a
 * `skip:card-queue` badge), and `releaseUsersFromWaitlist` stamps the grant
 * with no geo or eligibility check — so every released user resident in a
 * prohibited country (UA, IN, TR, VE, VN, IL, IQ, NP, NI) was shown a card
 * they can never get, and tapping it landed them on the `geo-blocked` screen.
 * `findActiveCard` is the same predicate `/card`'s own gate uses.
 *
 * Still loading keeps the surface: both destinations are safe landings, and
 * revealing the tab late reads worse than swapping it late.
 *
 * BottomNav mounts this app-wide, which is the pattern `utils/support-cache.ts`
 * warns off. The two reasons behind that rule don't hold here: BottomNav
 * renders only for logged-in users (never for guests, unlike SupportDrawer),
 * and neither query polls for the users it protects — `useRainCardOverview`
 * turns its 30s interval off on `hasApplication: false`, and `/card` info is a
 * 60s-stale one-shot. Home mounts both already (`useHomeFlow`,
 * `GettingStartedChecklist`), so on the normal path react-query dedupes and
 * this adds no request at all.
 */
export const useCardSurfaceAccess = (): CardSurfaceAccess => {
    const { hasCardAccess, isEligible } = useCardInfo()
    const { overview } = useRainCardOverview()
    const restrictions = useResidenceRestrictions()

    const hasIssuedCard = findActiveCard(overview) !== null
    const hasCardRelationship = hasIssuedCard || overview?.status?.hasApplication === true

    return {
        hasIssuedCard,
        hasCardRelationship,
        hasCardAccess,
        showCardSurface: hasCardRelationship || (!restrictions.card && isEligible !== false),
        cardHref: hasCardRelationship || hasCardAccess ? '/card' : '/shhhhh',
    }
}
