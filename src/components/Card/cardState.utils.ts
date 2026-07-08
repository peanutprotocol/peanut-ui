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
 *   loading → active → no-flow-access → rejected (incl. FAILED) →
 *   requires-support → requires-info → pending/manual-review →
 *   geo-blocked (no application, country on Rain's prohibited list) →
 *   eligibility-check (first arrival, not yet held) → skip-celebration →
 *   add-card → waitlist
 *
 * Removed in Phase 2 of the M2 Card Waitlist Launch:
 *   - 'pioneer'  — replaced by 'waitlist' (free queue) + 'waitlist-skip-celebration'
 */
export type CardTopLevelState =
    | 'loading'
    /** Outer-gate fail — user hasn't passed /shhhhh AND public launch isn't here yet. */
    | 'no-flow-access'
    /** First arrival from /shhhhh: press-and-hold "see if you qualify" gate.
     *  Once held, the user lands on celebration or waitlist depending on
     *  whether they hold a skip badge. */
    | 'eligibility-check'
    /** Queued — has flow access but no card access yet, no skip badge to celebrate. */
    | 'waitlist'
    /** One-time celebration: user has a skip badge AND hasn't acknowledged it yet.
     *  Reveals the share asset, then transitions to add-card. */
    | 'waitlist-skip-celebration'
    | 'add-card'
    | 'pending'
    | 'manual-review'
    /** Provider needs more information from the user (rail REQUIRES_INFORMATION /
     *  REQUIRES_EXTRA_INFORMATION). The capabilities read-model carries the
     *  display-ready reason — the screen surfaces it. */
    | 'requires-info'
    /** Our pipeline broke en route to the provider (rail REQUIRES_SUPPORT).
     *  Not self-fixable — support has to step in. */
    | 'requires-support'
    /** Country known (from KYC) and on Rain's prohibited-issuance list — the
     *  user can't apply, so block entry into the funnel before the
     *  press-and-hold moment. Only for users with NO existing application;
     *  in-flight/approved applicants keep their truthful rail state above. */
    | 'geo-blocked'
    | 'rejected'
    | 'active'

interface ComputeArgs {
    overview?: RainCardOverview
    cardInfo?: CardInfoResponse
    overviewLoading: boolean
    cardInfoLoading: boolean
    /** Has the user already acknowledged the badge-skip celebration on this
     *  device (localStorage)? Per-device on purpose — re-doing the funnel
     *  re-celebrates. */
    skipCelebrationSeen: boolean
    /** Has the user pressed-and-held through the eligibility-check screen
     *  yet? Per-mount React state (NOT persisted) — every fresh /card visit
     *  shows the gate again until a card is issued. Within the same mount,
     *  this stays true after the hold so the user isn't pulled back from
     *  celebration / add-card. */
    eligibilityCheckDone: boolean
}

export function computeCardState({
    overview,
    cardInfo,
    overviewLoading,
    cardInfoLoading,
    skipCelebrationSeen,
    eligibilityCheckDone,
}: ComputeArgs): CardTopLevelState {
    if (overviewLoading || cardInfoLoading) return 'loading'
    if (!overview || !cardInfo) return 'loading'

    // Active-card check FIRST, before the outer gate. Existing card holders
    // (legacy Pioneers, admin-granted users issued cards before /shhhhh
    // existed) may not have a flowEarlyAccess stamp — we must NOT bounce
    // them to the LP. Their card already lives, so always reach YourCardScreen.
    const hasIssuedCard = overview.cards.some((c) => c.status !== 'CANCELED')
    if (hasIssuedCard) return 'active'

    // Outer gate: pre-public-launch, only users who passed /shhhhh can enter
    // the funnel. BE's `flowEarlyAccess` field factors in the public-launch
    // date. Applied AFTER the active-card check above by design.
    if (!cardInfo.flowEarlyAccess) return 'no-flow-access'

    const rail = overview.status.railStatus
    const app = overview.status.applicationStatus

    // Terminal denial — always shows the rejection screen. FAILED is the
    // webhook mapping for a locked/canceled application: same dead end,
    // same screen.
    if (rail === 'REJECTED' || rail === 'FAILED') return 'rejected'

    // Our submission pipeline broke en route to the provider — re-applying
    // just returns "Application already submitted". Support has to step in.
    if (rail === 'REQUIRES_SUPPORT') return 'requires-support'

    // Provider needs more information from the user. These rails HAVE an
    // application, so falling through to add-card here caused the prod
    // infinite loop (apply → "Application already submitted" → add-card → …).
    if (rail === 'REQUIRES_INFORMATION' || rail === 'REQUIRES_EXTRA_INFORMATION') return 'requires-info'

    // Application still in flight on Rain's side → show status screen.
    // (railStatus is the raw backend RailStatus enum — 'IN_REVIEW' was never
    // a value of it; the old comparison was dead code.)
    if (rail === 'PENDING') {
        if (app === 'needsVerification' || app === 'needsInformation' || app === 'locked') {
            return 'manual-review'
        }
        return 'pending'
    }

    // Default-deny for forward-compat: any other non-ENABLED railStatus means
    // an application EXISTS in a state this build doesn't know. Falling
    // through to add-card would re-create the apply loop ("Application
    // already submitted" → add-card → …), so route unknowns to support.
    if (rail && rail !== 'ENABLED') return 'requires-support'

    // Country known (from KYC) and on Rain's prohibited-issuance list — no
    // point letting the user into the funnel (the BE apply gate would refuse
    // anyway). Checked BEFORE the press-and-hold so they aren't teased with
    // "see if you qualify". Scoped to `!rail` on purpose: an ENABLED rail
    // without a card is the re-issue path (already approved by Rain), which
    // stays untouched — mirroring the BE gate placement. Unknown-country
    // users (`geoProhibited` false/undefined) pass through; the BE re-checks
    // the Sumsub address at submission time.
    if (!rail && cardInfo.geoProhibited) return 'geo-blocked'

    // First arrival from /shhhhh: gate everything else behind the press-and-hold
    // "see if you qualify" moment. Applies whether the user ultimately lands on
    // celebration or waitlist — the user explicitly engages the door before
    // the verdict is revealed.
    if (!eligibilityCheckDone) return 'eligibility-check'

    // Rail ENABLED (or no application) without any non-canceled card. From
    // here, BE's hasCardAccess + skipBadges drive the new state machine.
    if (cardInfo.hasCardAccess) {
        // Everyone who just passed the eligibility hold + has card access
        // gets the celebration moment, not just skip-badge holders. The
        // headline copy inside the celebration branches on whether a skip
        // badge is present. Once seen (localStorage stamp), straight to
        // add-card on subsequent visits.
        if (!skipCelebrationSeen) {
            return 'waitlist-skip-celebration'
        }
        return 'add-card'
    }

    // No card access yet → queue.
    return 'waitlist'
}
