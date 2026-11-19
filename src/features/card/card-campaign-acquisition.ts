import { getRedirectUrl, setRedirectUrl } from '@/utils/general.utils'

// Written by the retired /shhhhh page before 2026-06. Signups started then may still be in flight.
const LEGACY_SHHHHH_REDIRECT = '/home?badge_campaign_continuation=shhhhh'

/** Keep campaign attribution through web signup and return to the card flow. */
export function queueCardCampaignContinuation(): void {
    setRedirectUrl('/card')
}

export function cardCampaignSignupRoute(): string {
    return '/setup?step=signup&redirect_uri=%2Fcard'
}

/** Existing in-flight signup markers continue to /card regardless of campaign outcome. */
export function settleCardCampaignContinuation(): '/card' | undefined {
    if (getRedirectUrl() === '/card') return '/card'
    if (getRedirectUrl() !== LEGACY_SHHHHH_REDIRECT) return undefined
    setRedirectUrl('/card')
    return '/card'
}
