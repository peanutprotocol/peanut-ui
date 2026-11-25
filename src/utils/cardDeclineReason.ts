/**
 * Map decline reasons / categories to a display-code the receipt drawer turns
 * into copy (`transaction.decline.*`). This module stays copy-free.
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
 * Unknown codes fall back to the generic `'generic'` code mandated by the
 * card-activity spec.
 */

export type DeclineCategory = 'limit_too_low' | 'insufficient_balance' | 'other'

/** Display cause. Callers map it to copy — this module stays copy-free. */
export type DeclineReasonCode =
    | 'limitTooLow'
    | 'insufficientBalance'
    | 'spendingLimitReached'
    | 'blockedMerchant'
    | 'cashLikeMerchant'
    | 'cardLocked'
    | 'invalidPin'
    | 'generic'

/**
 * Category-specific codes. NOTE: `'other'` is intentionally absent — it falls
 * through to the raw-code lookup so non-financial declines (blocked_merchant,
 * card_locked, invalid_pin) still resolve to their specific code.
 * Adding `'other'` here would mask the raw-code mapping for those cases.
 */
const CATEGORY_CODES: Record<string, DeclineReasonCode> = {
    limit_too_low: 'limitTooLow',
    insufficient_balance: 'insufficientBalance',
}

/**
 * Keys are normalized: lowercase + non-alphanumerics → underscore. So
 * `INSUFFICIENT_FUNDS`, `insufficient_funds`, and `"insufficient funds"` all
 * collide on `insufficient_funds`. Add new entries in normalized form only.
 */
const CODES: Record<string, DeclineReasonCode> = {
    insufficient_funds: 'insufficientBalance',
    // Rain prose seen in production webhooks (2026-05-11 Adidas decline):
    // "account credit limit exceeded" means the user has spent down their
    // available collateral — funding issue, not per-tx-limit. The matching
    // BE category is `insufficient_balance`; keep this mapping in sync.
    account_credit_limit_exceeded: 'insufficientBalance',
    credit_limit_exceeded: 'insufficientBalance',
    // Per-tx cardLimit breached (user's configured per-authorization cap)
    card_spending_limit_exceeded: 'spendingLimitReached',
    spending_limit_exceeded: 'spendingLimitReached',
    card_locked: 'cardLocked',
    invalid_pin: 'invalidPin',
}

/**
 * Visa MCCs for money transfers, cash and stored-value loads: 4829 money
 * transfer, 6010 manual cash disbursement, 6011 ATM cash, 6012 financial
 * institution merchandise and services, 6050 quasi-cash (member financial
 * institution), 6051 quasi-cash (non-financial merchant), 6540 stored-value
 * purchase or load (wallet top-ups). Rain blocks these MCCs. Same set as
 * `categorizeCardDecline` in peanut-api-ts src/notifications/card.ts.
 */
const CASH_LIKE_MCCS = new Set(['4829', '6010', '6011', '6012', '6050', '6051', '6540'])

/** Rain's reasons for a merchant or MCC block, as seen in prod (2026-11), in
 *  normalized form. They include "blocked mcc", "block transaction from
 *  high-risk merchant category codes [v3", "triggers for transactions from mcc
 *  6050 and 6051" and "block transactions from specified high-risk e-commerce
 *  merch…". */
const MERCHANT_BLOCK_MARKERS = [
    'blocked_mcc',
    'blocked_merchant',
    'merchant_categor',
    'mcc_6050',
    'high_risk_e_commerce',
]

/** Collapse Rain's three flavours (snake_case, SCREAMING_CASE, prose) into a
 *  single lookup key. lower-case + replace runs of non-alphanumerics with one
 *  underscore + trim edge underscores. */
function normalizeDeclineCode(code: string): string {
    return code
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
}

export function declineReasonCode(
    code: string | null | undefined,
    category?: DeclineCategory | null,
    mcc?: string | null
): DeclineReasonCode {
    // Prefer the BE-computed category — it disambiguates the
    // INSUFFICIENT_FUNDS/limit-too-low collision Rain leaves on the wire.
    if (category && CATEGORY_CODES[category]) return CATEGORY_CODES[category]
    if (!code) return 'generic'
    const normalized = normalizeDeclineCode(code)
    if (MERCHANT_BLOCK_MARKERS.some((marker) => normalized.includes(marker))) {
        return mcc && CASH_LIKE_MCCS.has(mcc.trim()) ? 'cashLikeMerchant' : 'blockedMerchant'
    }
    return CODES[normalized] ?? 'generic'
}
