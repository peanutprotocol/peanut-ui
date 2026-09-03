import { isAmountWithinBalance } from '@/utils/balance.utils'

/**
 * Bridge bank offramps have a $1 wire minimum
 * (https://apidocs.bridge.xyz/docs/transaction-costs). Per-country minimums
 * are enforced on the amount step; this is the hard floor the submit handler
 * re-checks synchronously — the amount arrives via a user-editable URL param.
 */
export const BRIDGE_OFFRAMP_MIN_USD = 1

export type WithdrawAmountCheck =
    | { ok: true; normalized: string }
    | { ok: false; reason: 'invalid' | 'belowMinimum' | 'insufficientBalance' | 'balanceLoading' }

function checkWithdrawUsdAmount(amount: string, balance: bigint | undefined, minUsd: number): WithdrawAmountCheck {
    const value = Number(amount)
    if (!Number.isFinite(value) || value <= 0) return { ok: false, reason: 'invalid' }
    if (value < minUsd) return { ok: false, reason: 'belowMinimum' }
    const normalized = value.toString()
    // exponent forms survive Number→toString for extreme magnitudes — refuse
    // anything that does not round-trip to a plain decimal
    if (!/^\d+(\.\d+)?$/.test(normalized)) return { ok: false, reason: 'invalid' }
    // an unloaded balance is NOT a pass: without the ceiling an edited
    // ?amount= above the user's funds could reach the provider before the
    // wallet send rejects it (Chip review round 3) — the submit stays
    // disabled until the balance is real
    if (balance === undefined) return { ok: false, reason: 'balanceLoading' }
    if (!isAmountWithinBalance(normalized, balance)) {
        return { ok: false, reason: 'insufficientBalance' }
    }
    return { ok: true, normalized }
}

/**
 * Validate + normalize the USD amount right before creating a bank offramp
 * (Chip review, PR #2917): the URL string must be a finite positive number at
 * or above the rail floor and within the displayed spendable balance. The
 * normalized decimal string is what goes on the wire — never the raw param.
 */
export function validateBankOfframpAmount(amount: string, balance: bigint | undefined): WithdrawAmountCheck {
    return checkWithdrawUsdAmount(amount, balance, BRIDGE_OFFRAMP_MIN_USD)
}

/**
 * Same contract for the crypto withdraw page (Chip review round 4): `?amount=`
 * must be a finite positive plain-decimal within the loaded balance before any
 * request/charge is persisted, and again before broadcast. No rail floor here —
 * same-chain USDC has no minimum (parity with send-via-link); the per-chain
 * Rhino route minimums are enforced separately by the page.
 */
export function validateCryptoWithdrawAmount(amount: string, balance: bigint | undefined): WithdrawAmountCheck {
    return checkWithdrawUsdAmount(amount, balance, 0)
}
