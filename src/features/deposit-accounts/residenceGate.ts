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
 * The residences a residence gate reads, in one derivation for every gate.
 *
 * The verified residence outranks the declared one, as it does on the
 * backend: the address collected at verification beats a self-asserted
 * declaration, so a declared country only counts while nothing is verified.
 * A second declared residence counts beside it (a dual resident).
 */
export function gatingResidenceIso2s(residence: {
    verified?: string | null
    declared?: string | null
    second?: string | null
}): string[] {
    const iso2s = [residence.verified ?? residence.declared, residence.second]
        .filter((iso2): iso2 is string => !!iso2)
        .map((iso2) => iso2.toUpperCase())
    return [...new Set(iso2s)]
}

/**
 * Does one of this user's residences match the corridor's country?
 *
 * A dual resident passes on either country, the same softening the restriction
 * rules already apply — a residence the user declared is a residence they can
 * prove.
 */
export function residenceAllows(corridor: DepositCorridor, residenceIso2s: string[]): boolean {
    const country = DEPOSIT_RAILS[corridor].residenceIso2
    if (!country) return true
    return residenceIso2s.some((iso2) => iso2.toUpperCase() === country.toUpperCase())
}
