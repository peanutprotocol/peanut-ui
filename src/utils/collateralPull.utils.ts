import { parseUsdAmountToUnits, usdcUnitsToRainCents } from './balance.utils'

export interface CollateralPull {
    /** The spend cannot be covered off card and will pull from the card balance. */
    pullsFromCard: boolean
    /** Cents that will leave the card: the whole amount when the card alone can
     *  cover it (collateral-only, one signature), otherwise only the shortfall
     *  (mixed). 0 when nothing is pulled. */
    fromCardCents: number
}

const NONE: CollateralPull = { pullsFromCard: false, fromCardCents: 0 }

/**
 * Mirrors `computeSpendStrategy` (spendPreflight.ts) on displayed balances so
 * the review step can say, BEFORE the passkey, that a spend is going to touch
 * the card balance — and therefore Rain's per-user withdrawal lock. Off-card
 * first; the card is the fallback; mixed only when neither covers it alone.
 * Unknown balances, a zero amount and a true shortfall all report no pull —
 * the insufficient-balance error owns that last case.
 */
export function computeCollateralPull(input: {
    amountUsd: string | number | null | undefined
    offCardUnits: bigint | undefined
    onCardCents: number | null
}): CollateralPull {
    if (input.amountUsd == null || input.offCardUnits === undefined || input.onCardCents === null) return NONE
    const units = parseUsdAmountToUnits(input.amountUsd)
    if (units === null || units <= 0n) return NONE
    if (units <= input.offCardUnits) return NONE

    const amountCents = Number(usdcUnitsToRainCents(units))
    const offCardCents = Number(usdcUnitsToRainCents(input.offCardUnits))
    const onCardCents = Math.max(0, Math.floor(input.onCardCents))
    if (onCardCents >= amountCents) return { pullsFromCard: true, fromCardCents: amountCents }

    const shortfallCents = amountCents - offCardCents
    if (shortfallCents <= 0 || offCardCents + onCardCents < amountCents) return NONE
    return { pullsFromCard: true, fromCardCents: shortfallCents }
}

/** m:ss for a remaining lock, never negative. */
export function formatLockRemaining(ms: number): string {
    const totalSec = Math.max(0, Math.ceil(ms / 1000))
    const m = Math.floor(totalSec / 60)
    const s = totalSec % 60
    return `${m}:${s.toString().padStart(2, '0')}`
}
