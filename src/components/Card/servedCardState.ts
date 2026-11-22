import type { RainCardOverview } from '@/services/rain'

export type ServedCardState = NonNullable<RainCardOverview['cardState']>

/**
 * The card state the API serves (peanut-api-ts `rain/card-state.ts`). The app derives nothing.
 * Every reader whose question is "is the card ready?" goes through here.
 */
export function servedCardState(overview: RainCardOverview): ServedCardState {
    return overview.cardState ?? legacyCardState(overview)
}

/**
 * The app's derivation from before the API served `cardState`, for an API response without it.
 * Removal trigger: delete this function and make `cardState` required once peanut-api-ts#2238
 * runs on prod `main` (the UI can deploy before the API during the rollout).
 */
function legacyCardState(overview: RainCardOverview): ServedCardState {
    // Existing holders must always be able to manage their card.
    if (overview.cards.some((c) => c.status !== 'CANCELED')) return 'active'
    const rail = overview.status.railStatus
    const app = overview.status.applicationStatus
    if (rail === 'REJECTED' || rail === 'FAILED') return 'rejected'
    if (rail === 'REQUIRES_SUPPORT') return 'requires-support'
    if (rail === 'REQUIRES_INFORMATION' || rail === 'REQUIRES_EXTRA_INFORMATION') return 'requires-info'
    if (rail === 'PENDING') {
        if (app === 'needsVerification' || app === 'needsInformation' || app === 'locked' || app === 'manualReview') {
            return 'manual-review'
        }
        return 'pending'
    }
    // An unknown non-ENABLED rail has an application: add-card would re-create the apply loop.
    if (rail && rail !== 'ENABLED') return 'requires-support'
    return 'add-card'
}
