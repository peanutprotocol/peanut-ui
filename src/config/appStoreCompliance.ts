import { isIOSNative } from '@/utils/capacitor'

/**
 * App Store Review Guideline 3.1.5(ii) forbids an app from offering currency —
 * crypto included — as compensation for completing tasks. Peanut's referral
 * programme ("You earn rewards whenever your friends use Peanut", points, tiers,
 * per-invite payouts) is exactly that, so inside the iOS app we hide every
 * surface that advertises, links to, or pays out referral rewards: the /rewards
 * and /points routes, their entry points, the invite-and-earn carousel CTAs, the
 * surprise-moment reward treatment, and the per-transaction points row.
 *
 * Inviting itself is NOT restricted and stays fully available on iOS — sharing
 * an invite link is only a problem when it comes with an offer of payment, so
 * the invite modal swaps its copy rather than disappearing. The programme still
 * pays out server-side; this gates presentation only.
 *
 * Deliberately iOS-only. Web and Android keep the full programme — this is an
 * App Store constraint, not a product decision.
 *
 * Call at render time, never at module scope: the platform is only knowable once
 * the Capacitor bridge is on `window`, and is `false` during prerender.
 */
export function isReferralRewardsHidden(): boolean {
    return isIOSNative()
}
