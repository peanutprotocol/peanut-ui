import { isAmountWithinBalance } from '@/utils/balance.utils'
import { getMinimumAmount } from '@/utils/bridge.utils'

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

/**
 * Fail-closed parse of a user-supplied USD amount string: a finite positive
 * number that round-trips to a plain decimal, or null. Exponential and
 * oversized forms (`1e21`) are refused — downstream `parseUnits` calls throw
 * on scientific notation, so they must never survive parsing (Chip round 7).
 */
export function parseUsdAmount(amount: string): string | null {
    const value = Number(amount)
    if (!Number.isFinite(value) || value <= 0) return null
    const normalized = value.toString()
    if (!/^\d+(\.\d+)?$/.test(normalized)) return null
    return normalized
}

function checkWithdrawUsdAmount(amount: string, balance: bigint | undefined, minUsd: number): WithdrawAmountCheck {
    const normalized = parseUsdAmount(amount)
    if (normalized === null) return { ok: false, reason: 'invalid' }
    if (Number(normalized) < minUsd) return { ok: false, reason: 'belowMinimum' }
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
 * The bank-withdraw minimum in USD for a destination country — the same
 * conversion the amount step applies (getMinimumAmount is local-currency:
 * GB £3, MX 50 MXN; sell rate = local per 1 USD; €1 ≈ $1). While the rate
 * has not loaded it falls back to the $1 Bridge floor — callers gate
 * submission on the rate for countries that need one (bankWithdrawMinNeedsRate).
 */
export function bankWithdrawMinUsd(countryIso2: string, exchangeRate: string | null | undefined): number {
    const localMin = getMinimumAmount(countryIso2)
    if (!countryIso2 || countryIso2 === 'US') return localMin
    if (localMin === 1) return 1 // EUR countries: €1 ≈ $1
    const rate = parseFloat(exchangeRate || '0')
    if (rate <= 0) return BRIDGE_OFFRAMP_MIN_USD // fallback while the rate loads
    return Math.ceil(localMin / rate)
}

/** True when the country's minimum is local-currency and needs the FX rate. */
export function bankWithdrawMinNeedsRate(countryIso2: string): boolean {
    return !!countryIso2 && countryIso2 !== 'US' && getMinimumAmount(countryIso2) !== 1
}

/**
 * Validate + normalize the USD amount right before creating a bank offramp
 * (Chip review, PR #2917): the URL string must be a finite positive number at
 * or above the rail floor and within the displayed spendable balance. The
 * normalized decimal string is what goes on the wire — never the raw param.
 * `minUsd` carries the destination's converted rail minimum (Chip round 5) —
 * the $1 Bridge floor always applies beneath it.
 */
export function validateBankOfframpAmount(
    amount: string,
    balance: bigint | undefined,
    minUsd: number = BRIDGE_OFFRAMP_MIN_USD
): WithdrawAmountCheck {
    return checkWithdrawUsdAmount(amount, balance, Math.max(BRIDGE_OFFRAMP_MIN_USD, minUsd))
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
