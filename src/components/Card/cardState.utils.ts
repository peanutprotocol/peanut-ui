import type { CardInfoResponse } from '@/services/card'
import type { RainCardOverview, RainCardSummary } from '@/services/rain'
import { servedCardState, type ServedCardState } from '@/components/Card/servedCardState'

/**
 * The one place that decides which card entry the UI operates on.
 * Every card-management screen (Your Card, limits, PIN, physical waitlist)
 * should go through this helper so they never diverge and never accidentally
 * target a CANCELED card's id. Returns the newest non-canceled card, or null.
 */
export function findActiveCard(overview: RainCardOverview | undefined): RainCardSummary | null {
    return overview?.cards.find((c) => c.status !== 'CANCELED') ?? null
}

/** The served card state plus two client-only states. */
export type CardTopLevelState =
    | 'loading'
    | ServedCardState
    /** Country known (from KYC) and on Rain's prohibited-issuance list — the
     *  user can't apply, so block entry into the application. Only for users with NO existing application;
     *  in-flight/approved applicants keep their truthful served state. */
    | 'geo-blocked'

interface ComputeArgs {
    overview?: RainCardOverview
    cardInfo?: CardInfoResponse
    overviewLoading: boolean
    cardInfoLoading: boolean
}

export function computeCardState({
    overview,
    cardInfo,
    overviewLoading,
    cardInfoLoading,
}: ComputeArgs): CardTopLevelState {
    if (overviewLoading || cardInfoLoading) return 'loading'
    if (!overview || !cardInfo) return 'loading'

    const state = servedCardState(overview)
    // Country known (from KYC) and on Rain's prohibited-issuance list: no point
    // starting verification (the BE apply gate would refuse anyway). Only with
    // no rail: an ENABLED rail without a card is the re-issue path (already
    // approved by Rain), mirroring the BE gate placement. The answer comes from
    // GET /card, not /rain/cards, so it is laid over the served state here.
    if (state === 'add-card' && !overview.status.railStatus && cardInfo.geoProhibited) return 'geo-blocked'
    return state
}
