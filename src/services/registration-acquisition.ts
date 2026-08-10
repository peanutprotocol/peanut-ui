import { saveToLocalStorage } from '@/utils/general.utils'
import { destinationForConfirmedBadgeCampaignAcquisition, type BadgeCampaignClaim } from './badge-campaigns'

/**
 * Registration settles queued URL badge campaigns after authentication. Preserve a
 * bespoke destination for the remaining setup flow only when the canonical
 * claim is confirmed; every other outcome leaves normal navigation untouched.
 */
export function persistRegistrationBadgeCampaignDestination(claims: readonly BadgeCampaignClaim[]): string {
    const destination = destinationForConfirmedBadgeCampaignAcquisition(claims)
    if (destination !== '/home') saveToLocalStorage('redirect', destination)
    return destination
}
