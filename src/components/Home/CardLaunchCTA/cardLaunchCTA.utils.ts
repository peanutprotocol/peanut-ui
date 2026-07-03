/**
 * Permanent ("gone forever") dismissal for the home card-launch CTA.
 *
 * Mirrors useActivationStatus' `peanut_card_activation_dismissed` localStorage
 * flag — NOT the carousel's `dismissedCarouselCTAs` map, which re-surfaces a CTA
 * after a 7-day cooldown. The launch CTA is a one-shot splash: once the user
 * clicks through OR closes it, it never comes back.
 */

const CARD_LAUNCH_CTA_DISMISSED_KEY = 'peanut_card_launch_cta_dismissed'

/** True if the user has already clicked through or dismissed the launch CTA. */
export function isCardLaunchCTADismissed(): boolean {
    if (typeof window === 'undefined') return false
    try {
        return localStorage.getItem(CARD_LAUNCH_CTA_DISMISSED_KEY) === 'true'
    } catch {
        // Private-mode / storage-disabled browsers: treat as not-dismissed so the
        // CTA still shows; worst case it re-appears on next mount (no crash).
        return false
    }
}

/** Permanently hide the launch CTA. Idempotent. */
export function dismissCardLaunchCTA(): void {
    if (typeof window === 'undefined') return
    try {
        localStorage.setItem(CARD_LAUNCH_CTA_DISMISSED_KEY, 'true')
    } catch {
        // No-op if storage is unavailable.
    }
}
