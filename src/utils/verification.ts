import { isMantecaSupportedCountryCode } from '@/constants/manteca.consts'
import type { IdentityVerification, RailCapability, RailOperation } from '@/types/capabilities'

/*
 * "Is the user verified?" has two answers, and they stay apart. Providers gate
 * their own rails; the identity check (Sumsub) only collects documents, so it
 * is never a money gate. Both answers read fields the API serves on /users/me
 * (`identityVerification`, `capabilities.rails`); nothing here interprets
 * provider state. State census, UI part 7a.
 */

/** The API's identity check passed: the documents were accepted. Says nothing about any rail. */
export function isIdentityVerified(identity: IdentityVerification | undefined): boolean {
    return identity?.status === 'verified'
}

/** A provider has enabled at least one rail for the user. */
export function hasAnyEnabledRail(rails: RailCapability[]): boolean {
    return rails.some((rail) => rail.status === 'enabled')
}

/**
 * True when the user may run `op` on a bank rail in `countryCode`, whoever the provider is.
 *
 *   - LATAM country (AR/BR/…): the bank rail for that country with `op`
 *     enabled. The operation matters: a pool-tier rail enables `pay` only,
 *     so every verified user can pay a Pix key while adding money (`deposit`)
 *     and withdrawing to an own account (`withdraw`) need the full account.
 *   - Other countries: any enabled bank rail.
 */
export function canUseBankRail(rails: RailCapability[], op: RailOperation, countryCode: string): boolean {
    const upper = countryCode.toUpperCase()
    if (isMantecaSupportedCountryCode(upper)) {
        return rails.some(
            (rail) =>
                rail.channel === 'bank' &&
                rail.country.toUpperCase() === upper &&
                (rail.operations?.[op] ?? rail.status) === 'enabled'
        )
    }
    return rails.some((rail) => rail.channel === 'bank' && rail.status === 'enabled')
}
