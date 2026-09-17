import { DEPOSIT_RAILS } from './rails'
import type { DepositCorridor } from './types'

/**
 * Corridors the provider opens only for a legal resident of that country.
 *
 * Everybody sees the rows — a Brazilian account is worth knowing about before
 * you move to Brazil — but only a resident can open one. Residence decides it,
 * never nationality: a Brazilian citizen living in Berlin gets the euro
 * account, and a German living in São Paulo gets the Brazilian one.
 */
export const RESIDENCE_GATED_CORRIDORS: DepositCorridor[] = ['BANK_TRANSFER_BR', 'BANK_TRANSFER_CO']

export function isResidenceGated(corridor: DepositCorridor): boolean {
    return RESIDENCE_GATED_CORRIDORS.includes(corridor)
}

/**
 * Does one of this user's residences match the corridor's country?
 *
 * A dual resident passes on either country, the same softening the restriction
 * rules already apply — a residence the user declared is a residence they can
 * prove.
 */
export function residenceAllows(corridor: DepositCorridor, residenceIso2s: string[]): boolean {
    if (!isResidenceGated(corridor)) return true
    const country = DEPOSIT_RAILS[corridor].flagIso2.toUpperCase()
    return residenceIso2s.some((iso2) => iso2.toUpperCase() === country)
}
