import { isConfirmedBadgeCampaignClaim, type BadgeCampaignClaim } from '@/services/badge-campaigns'
import { getRedirectUrl, saveToLocalStorage } from '@/utils/general.utils'

const WAITLIST_SKIP_BADGE_CODE = 'WAITLIST_SKIP'
const PENDING_SHHHHH_REDIRECT = '/home?badge_campaign_continuation=shhhhh'

/**
 * Start from a safe normal-app continuation. Registration replaces this marker
 * with `/card` only after the API confirms that this intent awarded Skip Pass.
 */
export function queueShhhhhCampaignContinuation(): void {
    saveToLocalStorage('redirect', PENDING_SHHHHH_REDIRECT)
}

export function shhhhhCampaignSignupRoute(): string {
    return '/setup?step=signup'
}

/**
 * The Shhhhh link has one established continuation: a confirmed Skip Pass goes
 * to the card flow. Every unconfirmed or unrelated campaign uses normal_app.
 */
export function destinationForShhhhhClaims(claims: readonly BadgeCampaignClaim[]): '/card' | '/home' {
    return claims.some((claim) => isConfirmedBadgeCampaignClaim(claim) && claim.badgeCode === WAITLIST_SKIP_BADGE_CODE)
        ? '/card'
        : '/home'
}

/**
 * Resolve the signed-out Shhhhh continuation once, after registration claims
 * settle. `undefined` means this registration did not originate at Shhhhh.
 */
export function settleShhhhhCampaignContinuation(claims: readonly BadgeCampaignClaim[]): '/card' | '/home' | undefined {
    if (getRedirectUrl() !== PENDING_SHHHHH_REDIRECT) return undefined
    const destination = destinationForShhhhhClaims(claims)
    saveToLocalStorage('redirect', destination)
    return destination
}
