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
 *   - `code` — Rain's raw decline string. Rain emits a mix of snake_case
 *     codes (`insufficient_funds`), SCREAMING_CASE legacy variants
 *     (`INSUFFICIENT_FUNDS`), AND human-readable prose
 *     (`"account credit limit exceeded"`). We normalize the code before
 *     lookup so all three shapes hit the same key.
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

/**
 * Keys are normalized: lowercase + non-alphanumerics → underscore. So
 * `INSUFFICIENT_FUNDS`, `insufficient_funds`, and `"insufficient funds"` all
 * collide on `insufficient_funds`. Add new entries in normalized form only.
 */
const FRIENDLY: Record<string, string> = {
    insufficient_funds: 'Insufficient balance',
    // Rain prose seen in production webhooks (2026-05-11 Adidas decline):
    // "account credit limit exceeded" means the user has spent down their
    // available collateral — funding issue, not per-tx-limit. The matching
    // BE category is `insufficient_balance`; keep this string in sync.
    account_credit_limit_exceeded: 'Insufficient balance',
    credit_limit_exceeded: 'Insufficient balance',
    // Per-tx cardLimit breached (user's configured per-authorization cap)
    card_spending_limit_exceeded: 'Spending limit reached',
    spending_limit_exceeded: 'Spending limit reached',
    blocked_merchant: "This merchant isn't supported",
    blocked_mcc: "This merchant isn't supported",
    card_locked: 'Your card is locked',
    invalid_pin: 'Incorrect PIN',
}

/** Collapse Rain's three flavours (snake_case, SCREAMING_CASE, prose) into a
 *  single lookup key. lower-case + replace runs of non-alphanumerics with one
 *  underscore + trim edge underscores. */
function normalizeDeclineCode(code: string): string {
    return code
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
}

export function friendlyDeclineReason(code: string | null | undefined, category?: DeclineCategory | null): string {
    // Prefer the BE-computed category — it disambiguates the
    // INSUFFICIENT_FUNDS/limit-too-low collision Rain leaves on the wire.
    if (category && CATEGORY_COPY[category]) return CATEGORY_COPY[category]
    if (!code) return 'Transaction declined'
    return FRIENDLY[normalizeDeclineCode(code)] ?? 'Transaction declined'
}
