import { DEPOSIT_RAILS, DEPOSIT_RAIL_ORDER } from './rails'
import type { DepositCorridor } from './types'

/**
 * Corridors the provider opens only for a legal resident of that country.
 *
 * The country lives on the rail itself (`residenceIso2`), so a corridor gains
 * or loses the rule by its catalogue entry and nothing else. Everybody sees
 * the rows — a Brazilian account is worth knowing about before you move to
 * Brazil — but only a resident can open one. Residence decides it, never
 * nationality: a Brazilian citizen living in Berlin gets the euro account, and
 * a German living in São Paulo gets the Brazilian one.
 */
export const RESIDENCE_GATED_CORRIDORS: DepositCorridor[] = DEPOSIT_RAIL_ORDER.filter(
    (corridor) => !!DEPOSIT_RAILS[corridor].residenceIso2
)

export function isResidenceGated(corridor: DepositCorridor): boolean {
    return !!DEPOSIT_RAILS[corridor].residenceIso2
}

/**
 * The residence a residence gate reads, in one derivation for every gate.
 *
 * The verified residence outranks the declared one, as it does on the
 * backend: the address collected at verification beats a self-asserted
 * declaration, so a declared country only counts while nothing is verified.
 * A second declared residence never counts: the API opens a Manteca local
 * account by the one residence (rule `peanut.manteca-local-residence`), so a
 * corridor opened by the second one could only end in a refusal.
 */
export function gatingResidenceIso2s(residence: { verified?: string | null; declared?: string | null }): string[] {
    const iso2 = residence.verified ?? residence.declared
    return iso2 ? [iso2.toUpperCase()] : []
}

/** Does the user's residence match the corridor's country? */
export function residenceAllows(corridor: DepositCorridor, residenceIso2s: string[]): boolean {
    const country = DEPOSIT_RAILS[corridor].residenceIso2
    if (!country) return true
    return residenceIso2s.some((iso2) => iso2.toUpperCase() === country.toUpperCase())
}

/**
 * Is a residence-gated corridor closed to this user?
 *
 * A rail that already moves money stays open whatever the residence says: the
 * user opened it while they lived there, and the provider still takes their
 * transfers. Only a corridor with no working rail behind it waits on a
 * residence. The Accounts rows and the Manteca top-up both ask this, so the
 * row and the flow behind it can never disagree (C4, TASK-23054).
 */
export function residenceCloses(corridor: DepositCorridor, residenceIso2s: string[], railWorks: boolean): boolean {
    return !railWorks && !residenceAllows(corridor, residenceIso2s)
}
