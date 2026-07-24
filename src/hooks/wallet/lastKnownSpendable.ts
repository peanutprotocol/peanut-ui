import { getUserPreferences, updateUserPreferences } from '@/utils/general.utils'

/**
 * Per-user persisted cache of the last fully-settled spendable total, so a cold
 * start can paint the previous number immediately and correct it in the
 * background.
 *
 * Why this exists: the displayed total is `smart + rainSpendingPower +
 * rainInTransit`, and BOTH Rain terms come from a single `/rain/cards` call.
 * Until that call has succeeded once, `rainCentsToUsdcUnits(undefined)` returns
 * 0n — which is indistinguishable from "this user has no collateral". For a card
 * user whose funds the auto-balancer swept out of the smart account, the sum then
 * craters to a confident, wrong `$0` (PEANUT-UI-QD5: /rain/cards times out at 10s
 * for hundreds of users). React Query retains the last successful data across a
 * failed REFETCH, so this only bites on the first load of a session — which is
 * exactly what this cache covers.
 *
 * ⚠️ DISPLAY ONLY. Never seed an affordability gate from this: the gates run on
 * `availableSpendableBalance`, which stays live precisely so a stale number can't
 * green-light a spend that leaves an orphan charge.
 */

export const readLastKnownSpendable = (userId: string | undefined): bigint | undefined => {
    const stored = getUserPreferences(userId)?.lastKnownSpendable
    if (!stored?.units) return undefined
    try {
        const units = BigInt(stored.units)
        return units < 0n ? undefined : units
    } catch {
        return undefined
    }
}

export const writeLastKnownSpendable = (userId: string | undefined, units: bigint): void => {
    if (!userId || units < 0n) return
    updateUserPreferences(userId, { lastKnownSpendable: { units: units.toString(), at: Date.now() } })
}
