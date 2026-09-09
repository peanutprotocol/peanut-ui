'use client'

import { findActiveCard } from '@/components/Card/cardState.utils'
import { useCardInfo } from '@/hooks/useCardInfo'
import { useRainCardOverview } from '@/hooks/useRainCardOverview'

/** Public applications retain known country restrictions and existing card access. */
export const useCardSurfaceAccess = () => {
    const { cardInfo } = useCardInfo()
    const { overview } = useRainCardOverview()
    const hasIssuedCard = findActiveCard(overview) !== null
    const hasCardRelationship = hasIssuedCard || overview?.status?.hasApplication === true
    return {
        hasIssuedCard,
        hasCardRelationship,
        showCardSurface: hasCardRelationship || cardInfo?.geoProhibited !== true,
        cardHref: '/card' as const,
    }
}
