/**
 * The speeds a USD bank withdrawal can take (TASK-23054).
 *
 * Standard ACH is the default and free; same-day ACH is a free opt-in on it.
 * A wire costs a flat fee that the backend sets and charges (GET
 * /bridge/offramp/rail-fees); the app never holds a number of its own. The
 * provider withholds the fee from the payout, so the bank receives the amount
 * less the fee.
 */

export const USD_PAYOUT_SPEEDS = ['ach', 'ach_same_day', 'wire'] as const
export type UsdPayoutSpeed = (typeof USD_PAYOUT_SPEEDS)[number]
export const DEFAULT_USD_PAYOUT_SPEED: UsdPayoutSpeed = 'ach'

/** Why a speed cannot be picked for this withdrawal. */
export type UsdPayoutSpeedBlock = 'belowMinimum' | 'accountCannotTake'

export interface UsdPayoutSpeedOption {
    speed: UsdPayoutSpeed
    /** Flat fee in USD, two decimals. */
    feeUsd: string
    /** The least this speed can send: the fee plus the provider's minimum. */
    minimumUsd: string
    block: UsdPayoutSpeedBlock | null
}

export interface UsdRailFees {
    minimumAfterFeeUsd: string
    rails: { rail: string; feeUsd: string }[]
}

/**
 * The speeds to offer, in order, each with its fee and whether it can be
 * picked. A speed the fee table does not list is not offered: an older
 * backend, or a failed read, leaves same-day ACH alone at no fee.
 *
 * `supportedRails` is the provider's own answer for this account
 * (`payment_rails.supported`); undefined means it did not say, and the
 * provider then decides at transfer time.
 */
export function usdPayoutSpeedOptions({
    fees,
    amountUsd,
    supportedRails,
}: {
    fees: UsdRailFees | null | undefined
    amountUsd: number
    supportedRails?: string[]
}): UsdPayoutSpeedOption[] {
    const minimumAfterFee = Number(fees?.minimumAfterFeeUsd ?? 1)
    return USD_PAYOUT_SPEEDS.flatMap((speed): UsdPayoutSpeedOption[] => {
        const listed = fees?.rails.find((rail) => rail.rail === speed)
        if (!listed && speed !== DEFAULT_USD_PAYOUT_SPEED) return []
        const feeUsd = listed?.feeUsd ?? '0.00'
        const minimum = Number(feeUsd) + minimumAfterFee
        // Only a wire can be blocked. Same-day ACH goes out next-day where the
        // bank cannot take same-day (apidocs, processing windows).
        const block: UsdPayoutSpeedBlock | null =
            speed === 'wire' && supportedRails && !supportedRails.includes(speed)
                ? 'accountCannotTake'
                : speed === 'wire' && Number(feeUsd) > 0 && !(amountUsd >= minimum)
                  ? 'belowMinimum'
                  : null
        return [{ speed, feeUsd, minimumUsd: minimum.toFixed(2), block }]
    })
}

/**
 * The speed the withdrawal goes out on: the one asked for when it can be
 * picked, else the default. A blocked wire never reaches the provider.
 */
export function effectiveUsdPayoutSpeed(options: UsdPayoutSpeedOption[], asked: UsdPayoutSpeed): UsdPayoutSpeed {
    const option = options.find((candidate) => candidate.speed === asked)
    return option && !option.block ? asked : DEFAULT_USD_PAYOUT_SPEED
}

/** What reaches the bank: the amount sent less the fee, in cents. */
export function usdAmountReceived(amountUsd: number, feeUsd: string): string {
    const cents = Math.round(amountUsd * 100) - Math.round(Number(feeUsd) * 100)
    return (Math.max(cents, 0) / 100).toFixed(2)
}
