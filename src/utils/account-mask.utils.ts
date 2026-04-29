/**
 * Per-rail bank account masking for receipt display.
 *
 * Receipts show transactions the user has already completed; the user has the
 * full identifier in their saved-accounts list. The receipt only needs enough
 * to remind them which account it was — last 4 digits suffice for numeric
 * rails. Free-form/identifier rails (PIX, Manteca aliases) leave the value
 * intact since masking would mangle the meaning.
 *
 * NOT used in deposit-instruction drawers — there the user needs to copy the
 * full identifier to wire from their bank, so we render the unmasked value.
 *
 * Compare per-rail rules in `MASK_RULES` (constants below). Default for an
 * unrecognised rail is `plain` — fail-open rather than mask wrong-shape input.
 */

type MaskMode =
    /** "**** **** **** 0217" — keep last 4, format in groups of 4. IBAN/CLABE/CBU/CVU. */
    | 'last-4'
    /** Last 4 of account number; routing number stays plain. US ACH / GB sort code. */
    | 'last-4-account-only'
    /** Truncate at 32 chars with ellipsis. PIX (email/phone/CPF/UUID — masking corrupts). */
    | 'truncate-32'
    /** Show as-is. Manteca aliases — short user-chosen strings. */
    | 'plain'

interface MaskRule {
    mode: MaskMode
}

/**
 * Per-rail rules. Account types come from the BE's `Account.type` field
 * (peanut-api-ts/prisma/schema.prisma `AccountType` enum).
 */
// Keyed on the uppercased account type. BE sends Prisma `AccountType` enum
// values (`BANK_IBAN`, `BANK_ACH`, `BANK_CLABE`, ...) — list both the bare
// name and the BANK_ prefix so display logic works regardless of which
// shape comes through. Without the BANK_* entries the lookup falls to
// the 'plain' fallback below, which renders the raw lowercase IBAN.
const MASK_RULES: Record<string, MaskRule> = {
    IBAN: { mode: 'last-4' },
    BANK_IBAN: { mode: 'last-4' },
    CLABE: { mode: 'last-4' },
    BANK_CLABE: { mode: 'last-4' },
    CBU: { mode: 'last-4' },
    CVU: { mode: 'last-4' },
    BANK_CBU: { mode: 'last-4' },
    BANK_CVU: { mode: 'last-4' },
    US: { mode: 'last-4-account-only' },
    BANK_ACH: { mode: 'last-4-account-only' },
    GB: { mode: 'last-4-account-only' },
    PIX: { mode: 'truncate-32' },
    BANK_PIX: { mode: 'truncate-32' },
    MANTECA: { mode: 'plain' },
    MANTECA_ALIAS: { mode: 'plain' },
}

/**
 * Mask a bank account identifier for receipt display per-rail.
 *
 * @param identifier the raw account string (IBAN, CBU, PIX key, etc.)
 * @param accountType the rail (`IBAN`, `CLABE`, `PIX`, …) — falls back to plain if unknown
 * @returns the masked display string. Empty/missing input returns ''.
 */
export function maskAccountIdentifier(
    identifier: string | null | undefined,
    accountType: string | null | undefined
): string {
    if (!identifier) return ''
    const rail = (accountType ?? '').toUpperCase()
    const rule = MASK_RULES[rail] ?? { mode: 'plain' as MaskMode }

    switch (rule.mode) {
        case 'last-4': {
            const cleaned = identifier.replace(/\s+/g, '')
            if (cleaned.length <= 4) return cleaned
            const last4 = cleaned.slice(-4)
            // Format as **** **** **** 1234 (groups of 4).
            return `**** **** **** ${last4}`
        }
        case 'last-4-account-only': {
            // For US ACH the saved identifier shape is variable — sometimes the
            // routing number is included, sometimes only the account number.
            // The conservative move: show the last 4 digits of whatever we
            // have. If a future BE shape exposes routingNumber separately, a
            // richer rendering ("Bank · **** 6789") slots in here.
            const cleaned = identifier.replace(/\s+/g, '')
            if (cleaned.length <= 4) return cleaned
            return `**** ${cleaned.slice(-4)}`
        }
        case 'truncate-32': {
            if (identifier.length <= 32) return identifier
            return identifier.slice(0, 29) + '…'
        }
        case 'plain':
            return identifier
    }
}
