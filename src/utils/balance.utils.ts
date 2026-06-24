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
 * Shared balance copy for the send-link, qr-pay and withdraw flows. (The
 * features/payments flows — direct-send/semantic-request/contribute-pot — keep
 * their own in-context wording.)
 *
 * Two distinct moments:
 *  - INSUFFICIENT — input-time gate, when the entered amount exceeds the full
 *    displayed balance (a real shortfall). Gates run on the DISPLAYED balance so
 *    we never block funds the live spend could actually route — see `useWallet`.
 *  - SETTLING — failure-time, when a spend that passed the gate can't be routed
 *    yet (the smart→collateral rebalance hasn't landed, or the ~30s-polled FE
 *    balance was momentarily ahead of chain). Deliberately generic — it must NOT
 *    expose the card-collateral mechanic — and it nudges a retry, since the FE
 *    balance is refetched on this failure and the spend usually succeeds shortly.
 */
export const INSUFFICIENT_BALANCE_MESSAGE = 'Not enough balance. Add funds to continue.'
export const BALANCE_SETTLING_MESSAGE = "Your balance isn't fully available yet. Please try again in a few seconds."

/**
 * Affordability gate for money-flows: can `amountUsd` be spent against the
 * DISPLAYED spendable balance (smart + all collateral, incl. in-transit)?
 * Gating on the displayed total — not an available-now subset — is deliberate:
 * the live spend routing reads the chain at submit, so a too-strict input gate
 * would block routable funds; a pass that can't be routed yet fails late.
 * Returns false while the balance is still loading (undefined). Pure + exported
 * so the gate contract is unit-tested independent of the `useWallet` hook.
 */
export const isDisplayBalanceSufficient = (
    amountUsd: string | number,
    spendableBalance: bigint | undefined
): boolean => {
    if (spendableBalance === undefined) return false
    const amount = typeof amountUsd === 'string' ? parseFloat(amountUsd) : amountUsd
    if (isNaN(amount) || amount < 0) return false
    return spendableBalance >= BigInt(Math.floor(amount * 10 ** PEANUT_WALLET_TOKEN_DECIMALS))
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
 * `isDisplayBalanceSufficient` (see `useWallet`).
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
