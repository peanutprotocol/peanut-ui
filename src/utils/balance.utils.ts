import { PEANUT_WALLET_TOKEN_DECIMALS } from '@/constants/zerodev.consts'
import { formatUnits } from 'viem'

export const printableUsdc = (balance: bigint): string => {
    // For 6 decimals, we want 2 decimal places in output
    // So we divide by 10^4 to keep only 2 decimal places, then format
    const scaleFactor = BigInt(10 ** (PEANUT_WALLET_TOKEN_DECIMALS - 2)) // 10^4 = 10000n
    const flooredBigint = (balance / scaleFactor) * scaleFactor
    const formatted = formatUnits(flooredBigint, PEANUT_WALLET_TOKEN_DECIMALS)
    return Number(formatted).toFixed(2)
}

/**
 * Why a would-be spend can't go through right now:
 *   • 'settling'     — covered by the displayed balance, but part is in-transit
 *                      card collateral that hasn't landed yet (≤ display, > available-now).
 *   • 'insufficient' — exceeds the displayed balance too (a real shortfall).
 * Returned by `useWallet().spendBlockReason(amount)`; `null` means it's fine.
 */
export type SpendBlockReason = 'settling' | 'insufficient'

/**
 * Single source of truth for affordability-gate copy across every money-flow
 * (send, pay, withdraw). The 'settling' string explains the ~10–45s window after
 * a card top-up where the displayed balance briefly exceeds what's routable —
 * so the user isn't told "insufficient" while the screen shows enough.
 */
export const SPEND_BLOCK_MESSAGE: Record<SpendBlockReason, string> = {
    // Deliberately generic — it must NOT expose the card-collateral mechanic.
    // Only seen in the rare ~10-45s window where funds are mid-rebalance; the
    // full balance is already on screen, this just says "give it a second".
    settling: 'Your balance is updating. Try again in a few seconds.',
    insufficient: 'Not enough balance. Add funds to continue.',
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
 * what the user can actually spend right now (`useSpendBundle` routes through
 * the smart account and landed collateral), so it backs the affordability gate
 * and spend routing.
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
 * In-transit funds aren't spendable until they land, so they are deliberately
 * EXCLUDED from `computeAvailableSpendable` (gate + routing). During the window
 * the displayed total therefore exceeds spendable-now by the in-flight amount —
 * by design — and reconciles within seconds once collateral lands.
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
