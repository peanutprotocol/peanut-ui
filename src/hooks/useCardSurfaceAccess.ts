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
    cardHref: '/card'
}

/** Unknown residence can enter verification; known prohibited residences cannot apply. */
export const useCardSurfaceAccess = (): CardSurfaceAccess => {
    const { cardInfo } = useCardInfo()
    const { overview } = useRainCardOverview()
    const restrictions = useResidenceRestrictions()
    const hasIssuedCard = findActiveCard(overview) !== null
    const hasCardRelationship = hasIssuedCard || overview?.status?.hasApplication === true

    return {
        hasIssuedCard,
        hasCardRelationship,
        showCardSurface: hasCardRelationship || (!restrictions.card && cardInfo?.geoProhibited !== true),
        cardHref: '/card',
    }
}
