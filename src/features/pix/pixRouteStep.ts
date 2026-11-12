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
 * `accept-tos` next action), the provider's own identity check on its page
 * where it takes no shared verification (`hosted-verify`: a `hosted-identity`
 * next action), the account the first use opens (`activate`), then the wait
 * while the provider reviews the verification. Refused and paused routes never
 * reach it: the Pix pages show those. Anything else is a case support finishes.
 */
export type PixSetupState = 'ready' | 'verify' | 'accept-terms' | 'hosted-verify' | 'activate' | 'pending' | 'support'

export function pixSetupState(
    route: Pick<CapabilityRoute, 'state' | 'action'> | undefined,
    actionKind: NextActionKind | undefined
): PixSetupState {
    switch (route?.state) {
        case 'ready':
            return 'ready'
        case 'pending':
            return 'pending'
        case 'action_required':
            if (route.action === VERIFY_ACTION) return 'verify'
            if (route.action === ACTIVATE_ACTION) return 'activate'
            if (actionKind === 'hosted-identity') return 'hosted-verify'
            return actionKind === 'accept-tos' ? 'accept-terms' : 'support'
        default:
            return 'support'
    }
}

/** The step of a route, reading the kind of the next action its step names. */
export function pixRouteStep(
    route: Pick<CapabilityRoute, 'state' | 'action'> | undefined,
    nextActions: readonly NextAction[]
): PixSetupState {
    return pixSetupState(route, nextActions.find((action) => action.key === route?.action)?.kind)
}

/** The provider's own set-up, its terms or its own identity check, which the Pix setup runs and our verification does not. */
export const isProviderOwnSetUp = (step: PixSetupState): boolean => step === 'accept-terms' || step === 'hosted-verify'
