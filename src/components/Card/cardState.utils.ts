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

/** Existing cards and provider application states take precedence over new applications. */
export type CardTopLevelState =
    | 'loading'
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
     *  user can't apply, so block entry into the application. Only for users with NO existing application;
     *  in-flight/approved applicants keep their truthful rail state above. */
    | 'geo-blocked'
    | 'rejected'
    | 'active'

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

    // Existing holders must always be able to manage their card.
    const hasIssuedCard = overview.cards.some((c) => c.status !== 'CANCELED')
    if (hasIssuedCard) return 'active'

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
    // point starting verification (the BE apply gate would refuse anyway).
    // Scoped to `!rail` on purpose: an ENABLED rail
    // without a card is the re-issue path (already approved by Rain), which
    // stays untouched — mirroring the BE gate placement. Unknown-country
    // users (`geoProhibited` false/undefined) pass through; the BE re-checks
    // the Sumsub address at submission time.
    if (!rail && cardInfo.geoProhibited) return 'geo-blocked'

    return 'add-card'
}
