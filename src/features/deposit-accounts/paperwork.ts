import type { KycPaperwork, PaperworkProduct } from '@/services/kyc-paperwork'
import type { GateState } from '@/utils/capability-gate'
import { DEPOSIT_RAILS, DEPOSIT_RAIL_ORDER, railIdFor } from './rails'
import { isHeld } from './resolveScreen'
import type { ClaimableCorridor, DepositAccountView, DepositCorridor, UnavailableCorridor } from './types'

/** The Bridge account behind each corridor, by the engine's product name (api `BRIDGE_PRODUCT_OF_RAIL`). */
export const CORRIDOR_PRODUCT: Partial<Record<DepositCorridor, PaperworkProduct>> = {
    ACH_US: 'bridge.usd',
    SEPA_EU: 'bridge.eur',
    FASTER_PAYMENTS_GB: 'bridge.gbp',
    SPEI_MX: 'bridge.mxn',
}

/**
 * The per-account refusal: the provider offers its other accounts in this
 * residence, not this one (USD in Bangladesh, EUR in Mali). Bank-wide refusals
 * already reach the app through the capability gate, in their own words.
 */
const ACCOUNT_REFUSALS: ReadonlySet<string> = new Set(['account_unavailable_in_residence'])

/**
 * The corridors the engine refuses this user's residence. Only an explicit
 * `available: false` closes one: the engine lists products only for the
 * features the user picked, so a missing product is unknown, not refused.
 */
export function corridorsClosedByPaperwork(paperwork: KycPaperwork | undefined): Set<DepositCorridor> {
    const refused = new Set(
        (paperwork?.products ?? [])
            .filter((verdict) => !verdict.available && verdict.reason && ACCOUNT_REFUSALS.has(verdict.reason))
            .map((verdict) => verdict.product)
    )
    return new Set(
        DEPOSIT_RAIL_ORDER.filter((corridor) => {
            const product = CORRIDOR_PRODUCT[corridor]
            return !!product && refused.has(product)
        })
    )
}

/**
 * Is a corridor the engine refused still closed for this user? An account
 * they hold stays readable, and a rail that already moves money stays open:
 * the provider gave it before the rule, and its own approval outranks our
 * reading of its published table (the residence gate's rule, TASK-23054).
 */
export function paperworkCloses(
    corridor: DepositCorridor,
    closed: ReadonlySet<DepositCorridor>,
    account: DepositAccountView | undefined,
    railWorks: boolean
): boolean {
    return closed.has(corridor) && !isHeld(account) && !railWorks
}

/**
 * The backend's corridor answers with the engine's refusals laid over them.
 * A refused corridor is never offered: it leaves `claimable`, and `unavailable`
 * names the residence, so every row, drawer and route reads "not available
 * where you live" instead of offering a verification that cannot open it.
 */
export function withPaperworkRefusals(
    {
        accounts,
        claimable,
        unavailable,
        gates,
    }: {
        accounts: Record<DepositCorridor, DepositAccountView | undefined>
        claimable: Record<DepositCorridor, ClaimableCorridor | undefined>
        unavailable: Record<DepositCorridor, UnavailableCorridor | undefined>
        gates: Record<DepositCorridor, GateState>
    },
    closed: ReadonlySet<DepositCorridor>
): {
    claimable: Record<DepositCorridor, ClaimableCorridor | undefined>
    unavailable: Record<DepositCorridor, UnavailableCorridor | undefined>
} {
    const shut = DEPOSIT_RAIL_ORDER.filter((corridor) =>
        paperworkCloses(corridor, closed, accounts[corridor], gates[corridor]?.kind === 'ready')
    )
    if (!shut.length) return { claimable, unavailable }
    const nextClaimable = { ...claimable }
    const nextUnavailable = { ...unavailable }
    for (const corridor of shut) {
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
