/**
 * Card expiry helpers — derived from Rain's expirationMonth + expirationYear.
 * No auto-renew column in DB; we compute "renews soon" client-side.
 */

const AUTO_RENEW_BANNER_DAYS = 14

export function daysUntilExpiry(expiryMonth: number, expiryYear: number, now: Date = new Date()): number {
    // Cards expire at end of expiry month (last day). Compute that day.
    const endOfMonth = new Date(expiryYear, expiryMonth, 0) // month is 1-based, day 0 = last day of previous
    const ms = endOfMonth.getTime() - now.getTime()
    return Math.ceil(ms / (1000 * 60 * 60 * 24))
}

export function shouldShowAutoRenewBanner(expiryMonth: number, expiryYear: number, now: Date = new Date()): boolean {
    const d = daysUntilExpiry(expiryMonth, expiryYear, now)
    return d > 0 && d <= AUTO_RENEW_BANNER_DAYS
}
