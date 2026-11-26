import { ACTIVATE_ACTION, VERIFY_ACTION } from '@/features/kyc-features/report'
import type { CapabilityRoute } from '@/types/capabilities'

/*
 * The one reading of a Pix route's step, for the Pix setup screen. Kept free of the flow's heavier
 * imports so the route helpers that many screens load can share it.
 */

/**
 * The route's step when the provider's account could not be set up because the user has no email
 * (the `provide-email` nextActions key, api capabilities/resolver.ts). Saving one retries the setup.
 */
export const PROVIDE_EMAIL_ACTION = 'provide-email'

/**
 * What the Pix setup step shows for the backend's route: the Peanut identity check first
 * (`verify`), then the account the first use opens (`activate`), then the wait while the provider
 * opens it. Avenia relies on our verification, so it has no step of its own (TASK-24947). A user
 * with no email adds one here (`email`, TASK-25335). Refused and paused routes never reach it: the
 * Pix pages show those. Anything else is a case support finishes.
 */
export type PixSetupState = 'ready' | 'verify' | 'activate' | 'email' | 'pending' | 'support'

export function pixSetupState(route: Pick<CapabilityRoute, 'state' | 'action'> | undefined): PixSetupState {
    switch (route?.state) {
        case 'ready':
            return 'ready'
        case 'pending':
            return 'pending'
        case 'action_required':
            if (route.action === VERIFY_ACTION) return 'verify'
            if (route.action === ACTIVATE_ACTION) return 'activate'
            if (route.action === PROVIDE_EMAIL_ACTION) return 'email'
            return 'support'
        default:
            return 'support'
    }
}

/**
 * Whether the account the first use opens needs no tap: Avenia relies on our verification and the
 * user gives it no consent of their own (Aleks, 2026-11-14), so its account opens as the Pix page
 * loads. Manteca keeps its first-use consent.
 */
export const pixOpensWithoutTap = (route: Pick<CapabilityRoute, 'provider'> | undefined): boolean =>
    route?.provider === 'avenia'
