import { ACTIVATE_ACTION, VERIFY_ACTION } from '@/features/kyc-features/report'
import type { CapabilityRoute, NextAction, NextActionKind } from '@/types/capabilities'

/*
 * The one reading of a Pix route's step, for the Pix setup screen and for the screens that send a
 * user there (Home, the BRL row). Kept free of the flow's heavier imports so the route helpers that
 * many screens load can share it.
 */

/**
 * What the Pix setup step shows for the backend's route: the Peanut identity
 * check first (`verify`), the provider's terms (the route's action is an
 * `accept-tos` next action that carries the document, `tosUrl`), the provider's
 * own identity check on its page where it takes no shared verification
 * (`hosted-verify`: a `hosted-identity` next action), the account the first use
 * opens (`activate`), a step the bank rails' screens already run (`rail-step`:
 * their terms, a document, the hosted check), then the wait while the provider
 * reviews the verification. Refused and paused routes never reach it: the Pix
 * pages show those. Anything else is a case support finishes.
 */
export type PixSetupState =
    | 'ready'
    | 'verify'
    | 'accept-terms'
    | 'hosted-verify'
    | 'activate'
    | 'rail-step'
    | 'pending'
    | 'support'

/**
 * The steps a provider's rail asks for in the kinds the bank rails use, so the Pix setup hands them to
 * the same screens: the terms Bridge serves by its own link, a Sumsub document, the hosted check, the
 * missing email, a new identity document, the questions of a feature.
 */
const RAIL_STEP_KINDS: ReadonlySet<NextActionKind> = new Set([
    'accept-tos',
    'sumsub',
    'bridge-hosted',
    'provide-email',
    'restart-identity',
    'questions',
])

export function pixSetupState(
    route: Pick<CapabilityRoute, 'state' | 'action'> | undefined,
    action: Pick<NextAction, 'kind' | 'tosUrl'> | undefined
): PixSetupState {
    switch (route?.state) {
        case 'ready':
            return 'ready'
        case 'pending':
            return 'pending'
        case 'action_required':
            if (route.action === VERIFY_ACTION) return 'verify'
            if (route.action === ACTIVATE_ACTION) return 'activate'
            if (action?.kind === 'hosted-identity') return 'hosted-verify'
            // A route's own terms name the document the acceptance records; the bank rails' terms
            // come from their provider's link and carry none.
            if (action?.kind === 'accept-tos' && action.tosUrl) return 'accept-terms'
            return action && RAIL_STEP_KINDS.has(action.kind) ? 'rail-step' : 'support'
        default:
            return 'support'
    }
}

/** The step of a route, reading the next action its step names. */
export function pixRouteStep(
    route: Pick<CapabilityRoute, 'state' | 'action'> | undefined,
    nextActions: readonly NextAction[]
): PixSetupState {
    return pixSetupState(
        route,
        nextActions.find((action) => action.key === route?.action)
    )
}

/** The provider's own set-up, its terms or its own identity check, which the Pix setup runs and our verification does not. */
export const isProviderOwnSetUp = (step: PixSetupState): boolean => step === 'accept-terms' || step === 'hosted-verify'
