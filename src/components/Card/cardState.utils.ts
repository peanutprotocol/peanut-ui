import type { CardInfoResponse } from '@/services/card'
import type { RainCardOverview, RainCardSummary } from '@/services/rain'

/**
 * The one place that decides which card entry the UI operates on.
 * Every card-management screen (Your Card, limits, PIN, physical waitlist)
 * should go through this helper so they never diverge and never accidentally
 * target a CANCELED card's id. Returns the newest non-canceled card, or null.
 */
export function findActiveCard(overview: RainCardOverview | undefined): RainCardSummary | null {
    return overview?.cards.find((c) => c.status !== 'CANCELED') ?? null
}

export type CardTopLevelState = 'loading' | 'pioneer' | 'add-card' | 'pending' | 'manual-review' | 'rejected' | 'active'

interface ComputeArgs {
    overview?: RainCardOverview
    pioneerInfo?: CardInfoResponse
    overviewLoading: boolean
    pioneerLoading: boolean
}

export function computeCardState({
    overview,
    pioneerInfo,
    overviewLoading,
    pioneerLoading,
}: ComputeArgs): CardTopLevelState {
    if (overviewLoading || pioneerLoading) return 'loading'
    if (!overview || !pioneerInfo) return 'loading'

    const hasIssuedCard = overview.cards.some((c) => c.status !== 'CANCELED')
    if (hasIssuedCard) return 'active'

    const rail = overview.status.railStatus
    const app = overview.status.applicationStatus

    // Terminal rejection — always shows the rejection screen.
    if (rail === 'REJECTED') return 'rejected'

    // Application still in flight on Rain's side → show status screen.
    if (rail === 'PENDING' || rail === 'IN_REVIEW') {
        if (app === 'needsVerification' || app === 'needsInformation' || app === 'locked') {
            return 'manual-review'
        }
        return 'pending'
    }

    // Rail ENABLED (or no application) without any non-canceled card means
    // the user either hasn't applied yet OR previously had a card and
    // canceled it. Either way, the correct next step is the Add-Card entry
    // (gated by hasCardAccess) rather than the "Setting up your card…" loader.
    if (pioneerInfo.hasCardAccess) return 'add-card'

    return 'pioneer'
}
