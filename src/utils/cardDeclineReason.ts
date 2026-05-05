/**
 * Translate raw Rain decline codes to friendly messages for the activity feed.
 * Backend persists the code as-is on intent metadata; the human-readable mapping
 * lives here so it can be tweaked / i18n'd without a migration.
 *
 * Codes from Rain's gateway responses (snake_case Rain shapes alongside the
 * older SCREAMING_CASE ones). Unknown codes fall back to the generic copy
 * mandated by the card-activity spec.
 */

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

export function friendlyDeclineReason(code: string | null | undefined): string {
    if (!code) return 'Transaction declined'
    return FRIENDLY[code] ?? FRIENDLY[code.toLowerCase()] ?? FRIENDLY[code.toUpperCase()] ?? 'Transaction declined'
}
