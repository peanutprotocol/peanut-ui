/**
 * Translate decline reasons / categories to friendly messages for the
 * activity feed and the receipt drawer.
 *
 * Two inputs land here:
 *   - `category` — BE-computed synthetic category (see `notifications/card.ts`
 *     in peanut-api-ts): `'limit_too_low' | 'insufficient_balance' | 'other'`.
 *     We prefer this when present because Rain reports `INSUFFICIENT_FUNDS`
 *     for both genuine shortfalls AND limit-too-low cases — the synthetic
 *     category distinguishes them so the user gets actionable copy.
 *   - `code` — Rain's raw decline string (snake_case alongside the older
 *     SCREAMING_CASE variants). Fallback when category is missing (older
 *     declines that pre-date the categorization), or for non-financial
 *     reasons (blocked merchant, locked card, etc.).
 *
 * Unknown codes fall back to the generic copy mandated by the card-activity
 * spec.
 */

export type DeclineCategory = 'limit_too_low' | 'insufficient_balance' | 'other'

/**
 * Category-specific copy. NOTE: `'other'` is intentionally absent — it falls
 * through to the raw-code lookup so non-financial declines (blocked_merchant,
 * card_locked, invalid_pin) still render their specific friendly copy.
 * Adding `'other'` here would mask the raw-code mapping for those cases.
 */
const CATEGORY_COPY: Record<string, string> = {
    limit_too_low: 'Card limit reached — increase your limit',
    insufficient_balance: 'Insufficient balance',
}

const FRIENDLY: Record<string, string> = {
    INSUFFICIENT_FUNDS: 'Insufficient balance',
    insufficient_funds: 'Insufficient balance',
    card_spending_limit_exceeded: 'Spending limit reached',
    CARD_SPENDING_LIMIT_EXCEEDED: 'Spending limit reached',
    blocked_merchant: "This merchant isn't supported",
    blocked_mcc: "This merchant isn't supported",
    BLOCKED_MERCHANT: "This merchant isn't supported",
    BLOCKED_MCC: "This merchant isn't supported",
    card_locked: 'Your card is locked',
    CARD_LOCKED: 'Your card is locked',
    invalid_pin: 'Incorrect PIN',
    INVALID_PIN: 'Incorrect PIN',
}

export function friendlyDeclineReason(code: string | null | undefined, category?: DeclineCategory | null): string {
    // Prefer the BE-computed category — it disambiguates the
    // INSUFFICIENT_FUNDS/limit-too-low collision Rain leaves on the wire.
    if (category && CATEGORY_COPY[category]) return CATEGORY_COPY[category]
    if (!code) return 'Transaction declined'
    return FRIENDLY[code] ?? FRIENDLY[code.toLowerCase()] ?? FRIENDLY[code.toUpperCase()] ?? 'Transaction declined'
}
