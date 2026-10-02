import { PEANUT_WALLET_TOKEN_DECIMALS } from '@/constants/wallet-token.consts'
import { formatUnits, parseUnits } from 'viem'

/**
 * Parse a USD amount (string or number) to token base units PRECISELY — the same
 * `parseUnits` the spend itself uses, so the gate verifies exactly what execution
 * will require (no float `Math.floor` divergence at the boundary). Returns null
 * for anything invalid — empty, NaN, negative, locale comma,
 * scientific/overflow/Infinity — so the gate fails closed and NEVER throws.
 *
 * It does NOT reject a fraction longer than the token carries: parseUnits
 * ROUNDS that rather than throwing. A caller that promises the amount to
 * somebody else must refuse the longer fraction itself — see parseUsdAmount in
 * features/withdraw/amount-validation.
 */
export const parseUsdAmountToUnits = (amountUsd: string | number): bigint | null => {
    try {
        const s = (typeof amountUsd === 'number' ? amountUsd.toString() : amountUsd).trim()
        if (!s) return null
        const units = parseUnits(s, PEANUT_WALLET_TOKEN_DECIMALS)
        return units < 0n ? null : units
    } catch {
        return null
    }
}

/**
 * Is the entered amount a real, spendable value (> 0)? String truthiness is not
 * enough — "0" and "0.00" are truthy and would create a zero-value on-chain
 * link/spend. Parses exactly like the spend does (parseUsdAmountToUnits), so
 * anything parseUnits would reject fails here first.
 */
export const isValidSendAmount = (amountUsd: string | number | null | undefined): boolean => {
    if (amountUsd == null) return false
    const units = parseUsdAmountToUnits(amountUsd)
    return units !== null && units > 0n
}

/**
 * Balance at or above which self-service account deletion is refused (see
 * `DeleteAccountButton`). Deletion is irreversible — login is blocked forever
 * and there is no reactivation path — so anything left behind is unreachable.
 * Sub-cent dust is exempt: it is neither displayable nor withdrawable, and
 * trapping a user in an account they asked to delete over rounding beats losing
 * it. Mirrors `DELETION_BALANCE_DUST_UNITS` in peanut-api-ts, which is the
 * authoritative gate.
 */
export const DELETION_BALANCE_DUST_UNITS = parseUnits('0.01', PEANUT_WALLET_TOKEN_DECIMALS)

export const printableUsdc = (balance: bigint): string => {
    // For 6 decimals, we want 2 decimal places in output
    // So we divide by 10^4 to keep only 2 decimal places, then format
    const scaleFactor = BigInt(10 ** (PEANUT_WALLET_TOKEN_DECIMALS - 2)) // 10^4 = 10000n
    const flooredBigint = (balance / scaleFactor) * scaleFactor
    const formatted = formatUnits(flooredBigint, PEANUT_WALLET_TOKEN_DECIMALS)
    return Number(formatted).toFixed(2)
}

/**
 * Shared balance error copy lives in the `errors` next-intl namespace:
 *  - `notEnoughBalanceAddFunds` — input-time gate, when the entered amount
 *    exceeds the full displayed balance (a real shortfall). Gates run on the
 *    DISPLAYED balance so we never block funds the live spend could route.
 *  - `balanceSettling` — failure-time, when a spend that passed the gate can't
 *    be routed yet (the smart→collateral rebalance hasn't landed). Deliberately
 *    generic — it must NOT expose the card-collateral mechanic — and it nudges a
 *    retry, since the FE balance is refetched on this failure.
 *
 * Components render these via `useTranslations('errors')`. When a rendered
 * balance message is compared to drive logic (retryable vs blocking), compare a
 * stable code, never the localized string.
 */

/**
 * Pure affordability check: does `balanceUnits` cover `amountUsd`? Parses the
 * amount the same way the spend does (parseUnits — precise, no float drift) and
 * fails closed on invalid/loading input (returns false, never throws).
 *
 * The CALLER chooses which balance to pass, and that choice is the gate policy:
 *  - DISPLAYED total (smart + landed + in-transit) for fail-late flows that take
 *    no irreversible step before spending (send-link, qr-pay, withdraw) — an
 *    in-transit amount passes and, if not yet routable, fails late.
 *  - AVAILABLE-NOW (smart + landed) for flows that do something irreversible
 *    BEFORE the spend — the features/payments flows `createCharge` first, so an
 *    in-transit amount must be blocked at input or it leaves an orphan charge.
 * Exported so the gate contract is unit-tested independent of `useWallet`.
 */
export const isAmountWithinBalance = (amountUsd: string | number, balanceUnits: bigint | undefined): boolean => {
    if (balanceUnits === undefined) return false
    const units = parseUsdAmountToUnits(amountUsd)
    if (units === null) return false
    return balanceUnits >= units
}

/**
 * Widen a Rain balance figure from integer cents (2 decimals) to a USDC
 * bigint (matching PEANUT_WALLET_TOKEN_DECIMALS, typically 6) so it can be
 * summed losslessly with the smart-account balance.
 *
 * Returns 0n for null/undefined/negative/non-finite inputs so callers can
 * safely pass `overview?.balance?.spendingPower` without pre-guarding.
 */
export const rainCentsToUsdcUnits = (spendingPowerCents: number | null | undefined): bigint => {
    if (spendingPowerCents == null || !Number.isFinite(spendingPowerCents) || spendingPowerCents <= 0) {
        return 0n
    }
    // cents (2dp) → USDC base units (PEANUT_WALLET_TOKEN_DECIMALS) — widen by 10^(decimals - 2)
    const widenFactor = BigInt(10 ** (PEANUT_WALLET_TOKEN_DECIMALS - 2))
    return BigInt(Math.floor(spendingPowerCents)) * widenFactor
}

/**
 * Debt owed to the card, in whole cents (> 0), or 0 when there is none.
 *
 * Rain reports negative `spendingPower` when a settlement captured more than
 * its auth hold (tip / FX true-up) on an already-drained collateral account.
 * The clamp in `rainCentsToUsdcUnits` hides that debt from balance sums — the
 * card screen surfaces it via this helper instead.
 */
export const cardBalanceDueCents = (spendingPowerCents: number | null | undefined): number => {
    if (spendingPowerCents == null || !Number.isFinite(spendingPowerCents) || spendingPowerCents >= 0) {
        return 0
    }
    return Math.round(-spendingPowerCents)
}

/**
 * Available-now spendable balance, as a USDC base-unit bigint (6dp) — the
 * smart-account balance plus Rain collateral `spendingPower`. This is what
 * `useSpendBundle` can actually route through right now, and the total the
 * wallet displays (see `useWallet`).
 */
export const computeAvailableSpendable = (
    smartBalance: bigint,
    spendingPowerCents: number | null | undefined
): bigint => smartBalance + rainCentsToUsdcUnits(spendingPowerCents)

/**
 * Is the Rain half of the balance an ANSWER, or merely absent?
 *
 * `rainCentsToUsdcUnits(undefined)` is 0n, so a missing overview is arithmetically
 * identical to "this user has no collateral" — the root of the $0 balance bug.
 * A user with no card is a real zero; an overview that never arrived, or one the
 * backend flagged `balanceUnavailable` with nothing to fall back on, is unknown.
 *
 * Shared so the display path (`useWallet`) and the spend path (`useSpendBundle`)
 * answer this question identically — they were never allowed to disagree about
 * whether a Rain figure can be trusted.
 */
export const isRainBalanceKnown = (
    overview: { balance: unknown; balanceUnavailable?: boolean } | null | undefined
): boolean => !!overview && !(overview.balanceUnavailable && overview.balance == null)

/**
 * Convert a USDC base-unit amount (PEANUT_WALLET_TOKEN_DECIMALS, typically 6dp)
 * to cents (2dp), the unit Rain's `/signatures/withdrawals` API takes on its
 * INPUT side. Rounds up so a sub-cent shortfall still withdraws at least one
 * cent — Rain rejects 0-amount withdrawals.
 *
 * Asymmetry warning: Rain accepts cents on input but RETURNS the signed amount
 * in USDC base units (it's what the EIP-712 message + on-chain coordinator sign
 * over). The prepare → /submit roundtrip is cents-in / base-units-out. Don't
 * use this function on values returned from Rain.
 */
export const usdcUnitsToRainCents = (amountUnits: bigint): bigint => {
    if (amountUnits <= 0n) return 0n
    const divisor = 10n ** BigInt(PEANUT_WALLET_TOKEN_DECIMALS - 2)
    return (amountUnits + divisor - 1n) / divisor
}
