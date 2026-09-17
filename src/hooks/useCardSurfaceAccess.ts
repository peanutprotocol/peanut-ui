'use client'

import { useCardInfo } from '@/hooks/useCardInfo'
import { useCapabilities } from '@/hooks/useCapabilities'
import { useResidenceRestrictions } from '@/hooks/useResidenceRestrictions'

export interface CardSurfaceAccess {
    hasIssuedCard: boolean
    /** Existing cards and applications stay accessible even if residence changes. */
    hasCardRelationship: boolean
    showCardSurface: boolean
    /**
     * A card SPEND is reachable: an issued card, or a residence that can
     * still obtain one. A prohibited residence with only a pending
     * application shows the surface (to watch its status) but must not be
     * promised card spending — that application cannot become a card.
     * While cardInfo is still loading this collapses to false (unless a
     * card is already issued) — never tease the spend arm to a user whose
     * residence may come back prohibited.
     */
    canSpendPathViaCard: boolean
    cardHref: '/card'
}

/** Unknown residence can enter verification; known prohibited residences cannot apply. */
export const useCardSurfaceAccess = (): CardSurfaceAccess => {
    const { cardInfo } = useCardInfo()
    const { rails, channelOf } = useCapabilities()
    const restrictions = useResidenceRestrictions()
    // /users/me already carries the backend-normalized capability block. Using
    // it here avoids calling /rain/cards (and potentially Rain's balance API)
    // just to decide whether one Profile menu row should be visible. This is
    // the same relationship boundary used by the Home card offer.
    const cardRails = rails.filter((rail) => channelOf(rail) === 'card')
    // The Rain rail status describes the application, so it remains enabled
    // after a card is canceled. The API refines operations.pay from the actual
    // card status and enables it only for ACTIVE cards. LOCKED and
    // NOT_ACTIVATED cards keep the surface reachable through the application
    // rail but are not presented as a currently spendable card.
    const hasIssuedCard = cardRails.some((rail) => rail.operations?.pay === 'enabled')
    const hasCardRelationship = cardRails.length > 0
    const canApply = !restrictions.card && cardInfo?.geoProhibited !== true

    return {
        hasIssuedCard,
        hasCardRelationship,
        showCardSurface: hasCardRelationship || canApply,
        // spend needs a loaded cardInfo: undefined (loading/error) must not
        // read as "not prohibited" and flash the card arm before the
        // geo answer lands
        canSpendPathViaCard: hasIssuedCard || (cardInfo !== undefined && canApply),
        cardHref: '/card',
    }
}
