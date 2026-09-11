import { getRedirectUrl, saveToLocalStorage } from '@/utils/general.utils'

const PENDING_SHHHHH_REDIRECT = '/home?badge_campaign_continuation=shhhhh'

/** Preserve campaign attribution through signup and return to the public card flow. */
export function queueShhhhhCampaignContinuation(): void {
    saveToLocalStorage('redirect', '/card')
}

export function shhhhhCampaignSignupRoute(): string {
    return '/setup?step=signup&redirect_uri=%2Fcard'
}

/** Existing in-flight signup markers continue to /card regardless of campaign outcome. */
export function settleShhhhhCampaignContinuation(): '/card' | undefined {
    if (getRedirectUrl() === '/card') return '/card'
    if (getRedirectUrl() !== PENDING_SHHHHH_REDIRECT) return undefined
    saveToLocalStorage('redirect', '/card')
    return '/card'
}
