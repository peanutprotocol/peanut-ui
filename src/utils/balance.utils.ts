import { PEANUT_WALLET_TOKEN_DECIMALS } from '@/constants/zerodev.consts'
import { formatUnits, parseUnits } from 'viem'

/**
 * Parse a USD amount (string or number) to token base units PRECISELY — the same
 * `parseUnits` the spend itself uses, so the gate verifies exactly what execution
 * will require (no float `Math.floor` divergence at the boundary). Returns null
 * for anything invalid — empty, NaN, negative, locale comma, >decimals fraction,
 * scientific/overflow/Infinity — so the gate fails closed and NEVER throws.
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
 * Available-now spendable balance, as a USDC base-unit bigint (6dp) — the
 * smart-account balance plus landed Rain collateral `spendingPower`. This is
 * what `useSpendBundle` can actually route through right now. It is the base of
 * `computeDisplaySpendable` (which adds in-transit on top); it does NOT back the
 * input affordability gate — that gates on the displayed total via
 * `isAmountWithinBalance` (see `useWallet`).
 */
export const computeAvailableSpendable = (
    smartBalance: bigint,
    spendingPowerCents: number | null | undefined
): bigint => smartBalance + rainCentsToUsdcUnits(spendingPowerCents)

/**
 * Total spendable balance for DISPLAY, as a USDC base-unit bigint (6dp) —
 * available-now plus card collateral top-ups still in transit.
 *
 * The auto-balancer debits the smart account on-chain ~10–45s before Rain
 * credits the collateral; in that gap the funds are in neither bucket and the
 * raw `smart + spendingPower` sum craters to 0. Adding the in-transit amount
 * (from the backend's `inTransitToCollateralCents`) keeps the unified balance
 * steady through the handoff.
 *
 * In-transit funds aren't routable until they land, so they are excluded from
 * `computeAvailableSpendable` (what spend routing can actually use). The input
 * gate, by contrast, runs on THIS displayed total — a spend that can't be
 * routed yet fails late rather than being blocked at input. The displayed total
 * reconciles within seconds once collateral lands.
 */
export const computeDisplaySpendable = (
    smartBalance: bigint,
    spendingPowerCents: number | null | undefined,
    inTransitToCollateralCents: number | null | undefined
): bigint =>
    computeAvailableSpendable(smartBalance, spendingPowerCents) + rainCentsToUsdcUnits(inTransitToCollateralCents)

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
