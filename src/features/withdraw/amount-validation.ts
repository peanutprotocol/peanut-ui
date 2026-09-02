import { isAmountWithinBalance } from '@/utils/balance.utils'

/**
 * Bridge bank offramps have a $1 wire minimum
 * (https://apidocs.bridge.xyz/docs/transaction-costs). Per-country minimums
 * are enforced on the amount step; this is the hard floor the submit handler
 * re-checks synchronously — the amount arrives via a user-editable URL param.
 */
export const BRIDGE_OFFRAMP_MIN_USD = 1

export type BankOfframpAmountCheck =
    | { ok: true; normalized: string }
    | { ok: false; reason: 'invalid' | 'belowMinimum' | 'insufficientBalance' }

/**
 * Validate + normalize the USD amount right before creating a bank offramp
 * (Chip review, PR #2917): the URL string must be a finite positive number at
 * or above the rail floor and within the displayed spendable balance. The
 * normalized decimal string is what goes on the wire — never the raw param.
 */
export function validateBankOfframpAmount(amount: string, balance: bigint | undefined): BankOfframpAmountCheck {
    const value = Number(amount)
    if (!Number.isFinite(value) || value <= 0) return { ok: false, reason: 'invalid' }
    if (value < BRIDGE_OFFRAMP_MIN_USD) return { ok: false, reason: 'belowMinimum' }
    const normalized = value.toString()
    // exponent forms survive Number→toString for extreme magnitudes — refuse
    // anything that does not round-trip to a plain decimal
    if (!/^\d+(\.\d+)?$/.test(normalized)) return { ok: false, reason: 'invalid' }
    if (balance !== undefined && !isAmountWithinBalance(normalized, balance)) {
        return { ok: false, reason: 'insufficientBalance' }
    }
    return { ok: true, normalized }
}
