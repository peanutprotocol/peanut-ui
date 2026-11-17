import { ACTIVATE_ACTION, VERIFY_ACTION } from '@/features/kyc-features/report'
import type { CapabilityRoute, NextAction } from '@/types/capabilities'

/*
 * The one reading of a Pix route's step, for the Pix setup screen and the Pix flows that show it.
 * Kept free of the flow's heavier imports so the route helpers that many screens load can share it.
 */

type PixRouteStepInput = Pick<CapabilityRoute, 'state' | 'action' | 'terms'>

/**
 * The provider's terms the route still asks the user to accept (TASK-25073), in either shape the API
 * sends: the route's `terms`, whatever its state (`ready` too), or an `action_required` route whose
 * action is an `accept-tos` next action (the shape until 14 Nov 2026). Both read as the one terms
 * step, so the API can move from one to the other with no app release. A refused or paused route asks
 * nothing. `url` is the document the API versions and hashes.
 */
export function pixRouteTerms(
    route: PixRouteStepInput | undefined,
    nextActions: readonly NextAction[]
): { key: string; url?: string } | null {
    if (!route || route.state === 'refused' || route.state === 'paused') return null
    if (route.terms) return route.terms
    if (route.state !== 'action_required') return null
    const action = nextActions.find((next) => next.key === route.action && next.kind === 'accept-tos')
    return action ? { key: action.key, url: action.tosUrl } : null
}

/**
 * What the Pix setup step shows for the backend's route: the Peanut identity check first
 * (`verify`), then the provider's terms, which the user accepts once (`accept-terms`: Avenia's,
 * TASK-25073), then the account the first use opens (`activate`), then the wait while the provider
 * opens it. A route that is ready but still names terms shows the terms: an existing account accepts
 * them at its next Pix use. Refused and paused routes never reach it: the Pix pages show those.
 * Anything else is a case support finishes.
 *
 * `setAsideTerms` reads the route as if its terms were accepted: a Pix flow that has started asks for
 * them at its next entry, not in the middle (`usePixFlowSetupState`).
 */
export type PixSetupState = 'ready' | 'verify' | 'accept-terms' | 'activate' | 'pending' | 'support'

export function pixSetupState(
    route: PixRouteStepInput | undefined,
    nextActions: readonly NextAction[],
    { setAsideTerms = false }: { setAsideTerms?: boolean } = {}
): PixSetupState {
    if (route?.state === 'action_required' && route.action === VERIFY_ACTION) return 'verify'
    const terms = pixRouteTerms(route, nextActions)
    if (terms && !setAsideTerms) return 'accept-terms'
    switch (route?.state) {
        case 'ready':
            return 'ready'
        case 'pending':
            return 'pending'
        case 'action_required':
            if (route.action === ACTIVATE_ACTION) return 'activate'
            // the route's step is the terms themselves, set aside: nothing else is left
            return terms && route.action === terms.key ? 'ready' : 'support'
        default:
            return 'support'
    }
}

/**
 * Whether the account the first use opens needs no tap: Avenia relies on our verification, and its
 * terms are accepted on their own step before it (`accept-terms`), so its account opens as the Pix
 * page loads. Manteca keeps its first-use consent.
 */
export const pixOpensWithoutTap = (route: Pick<CapabilityRoute, 'provider'> | undefined): boolean =>
    route?.provider === 'avenia'
