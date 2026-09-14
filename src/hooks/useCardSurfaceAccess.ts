'use client'

import { findActiveCard } from '@/components/Card/cardState.utils'
import { useCardInfo } from '@/hooks/useCardInfo'
import { useRainCardOverview } from '@/hooks/useRainCardOverview'
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
     */
    canSpendPathViaCard: boolean
    cardHref: '/card'
}

/** Unknown residence can enter verification; known prohibited residences cannot apply. */
export const useCardSurfaceAccess = (): CardSurfaceAccess => {
    const { cardInfo } = useCardInfo()
    const { overview } = useRainCardOverview()
    const restrictions = useResidenceRestrictions()
    const hasIssuedCard = findActiveCard(overview) !== null
    const hasCardRelationship = hasIssuedCard || overview?.status?.hasApplication === true
    const canApply = !restrictions.card && cardInfo?.geoProhibited !== true

    return {
        hasIssuedCard,
        hasCardRelationship,
        showCardSurface: hasCardRelationship || canApply,
        canSpendPathViaCard: hasIssuedCard || canApply,
        cardHref: '/card',
    }
}
