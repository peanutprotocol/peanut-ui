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

/**
 * Top-level state for the /card flow.
 *
 * Precedence (top wins) in `computeCardState`:
 *   loading → no-flow-access → active → rejected → pending/manual-review →
 *   hasCardAccess?: add-card → hasUnacknowledgedSkipBadge?: waitlist-skip-celebration → waitlist
 *
 * Removed in Phase 2 of the M2 Card Waitlist Launch:
 *   - 'pioneer'  — replaced by 'waitlist' (free queue) + 'waitlist-skip-celebration'
 */
export type CardTopLevelState =
    | 'loading'
    /** Outer-gate fail — user hasn't passed /shhhhh AND public launch isn't here yet. */
    | 'no-flow-access'
    /** Queued — has flow access but no card access yet, no skip badge to celebrate. */
    | 'waitlist'
    /** One-time celebration: user has a skip badge AND hasn't acknowledged it yet.
     *  Reveals the share asset, then transitions to add-card. */
    | 'waitlist-skip-celebration'
    | 'add-card'
    | 'pending'
    | 'manual-review'
    | 'rejected'
    | 'active'

interface ComputeArgs {
    overview?: RainCardOverview
    cardInfo?: CardInfoResponse
    overviewLoading: boolean
    cardInfoLoading: boolean
    /** Has the user already seen the badge-skip celebration in this app session
     *  OR in a prior session (`cardWaitlistSkipCelebrationSeenAt` set)? */
    skipCelebrationSeen: boolean
}

export function computeCardState({
    overview,
    cardInfo,
    overviewLoading,
    cardInfoLoading,
    skipCelebrationSeen,
}: ComputeArgs): CardTopLevelState {
    if (overviewLoading || cardInfoLoading) return 'loading'
    if (!overview || !cardInfo) return 'loading'

    // Outer gate: pre-public-launch, only users who passed /shhhhh can enter.
    // BE's `flowEarlyAccess` field already factors in the public-launch date.
    if (!cardInfo.flowEarlyAccess) return 'no-flow-access'

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

    // Rail ENABLED (or no application) without any non-canceled card. From
    // here, BE's hasCardAccess + skipBadges drive the new state machine.
    if (cardInfo.hasCardAccess) {
        // User has access; check if a skip-badge celebration is owed.
        if (cardInfo.skipBadges.length > 0 && !skipCelebrationSeen) {
            return 'waitlist-skip-celebration'
        }
        return 'add-card'
    }

    // No card access yet → queue.
    return 'waitlist'
}
