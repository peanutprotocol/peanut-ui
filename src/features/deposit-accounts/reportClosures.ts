import { reportEntry } from '@/features/kyc-features/report'
import type { FeatureReport, RailCapability } from '@/types/capabilities'
import { DEPOSIT_RAILS, DEPOSIT_RAIL_ORDER, railIdFor } from './rails'
import { isHeld } from './resolveScreen'
import type { ClaimableCorridor, DepositAccountView, DepositCorridor, UnavailableCorridor } from './types'

/**
 * The backend's corridor answers with the feature report's refusals laid over
 * them. An account the report refuses with no way out is never offered, nor a
 * verification that cannot open it; its row says it is not available. One the
 * user holds stays readable.
 */
export function closeRefusedCorridors(
    report: FeatureReport | undefined,
    rails: readonly RailCapability[],
    {
        accounts,
        claimable,
        unavailable,
    }: {
        accounts: Record<DepositCorridor, DepositAccountView | undefined>
        claimable: Record<DepositCorridor, ClaimableCorridor | undefined>
        unavailable: Record<DepositCorridor, UnavailableCorridor | undefined>
    }
): {
    claimable: Record<DepositCorridor, ClaimableCorridor | undefined>
    unavailable: Record<DepositCorridor, UnavailableCorridor | undefined>
} {
    if (!report) return { claimable, unavailable }
    const nextClaimable = { ...claimable }
    const nextUnavailable = { ...unavailable }
    for (const corridor of DEPOSIT_RAIL_ORDER) {
        const entry = reportEntry(report, 'deposit', { railId: railIdFor(corridor) }, rails)
        if (entry.state !== 'refused' || entry.action || isHeld(accounts[corridor])) continue
        const rail = DEPOSIT_RAILS[corridor]
        nextClaimable[corridor] = undefined
        nextUnavailable[corridor] = {
            railId: railIdFor(corridor),
            method: corridor,
            country: rail.flagIso2.toUpperCase(),
            currency: rail.currency,
            ...unavailable[corridor],
            reason: 'not-offered',
            cause: 'residence-restricted',
        }
    }
    return { claimable: nextClaimable, unavailable: nextUnavailable }
}
