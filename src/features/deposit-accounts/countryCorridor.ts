import { BRIDGE_ALPHA3_TO_ALPHA2, type CountryData } from '@/components/AddMoney/consts'
import { DEPOSIT_RAILS, DEPOSIT_RAIL_ORDER } from './rails'
import type { DepositCorridor } from './types'

/**
 * Rails whose flag names a zone rather than one country. Their members cannot
 * be matched by country code, so the currency decides: every SEPA country
 * paying in euro reaches the one euro corridor.
 */
const ZONE_FLAGS = new Set(['eu'])

/** the countries the euro zone rail actually serves — the same list the bank country list is built from */
const SEPA_MEMBERS = new Set(Object.values(BRIDGE_ALPHA3_TO_ALPHA2))

/**
 * Which deposit corridor a country belongs to, or none.
 *
 * Read entirely from `DEPOSIT_RAILS`, so a corridor added there is routable
 * here without a second table to remember. That is the point: the add-money
 * country pick and the get-paid list now answer "what does this corridor do"
 * from one place, and a country whose corridor is not a standing account
 * follows the same rail's `topUpHref` to the flow that is.
 */
export function corridorForCountry(
    country: Pick<CountryData, 'type' | 'iso2' | 'currency'>
): DepositCorridor | undefined {
    if (country.type !== 'country') return undefined

    const iso2 = country.iso2?.toUpperCase()
    const currency = country.currency?.toUpperCase()
    if (!iso2) return undefined

    const byCountry = DEPOSIT_RAIL_ORDER.find((corridor) => {
        const rail = DEPOSIT_RAILS[corridor]
        return !ZONE_FLAGS.has(rail.flagIso2) && rail.flagIso2.toUpperCase() === iso2
    })
    if (byCountry) return byCountry

    // A zone rail serves a named membership, so the currency alone is not
    // enough: Ecuador prices in dollars and has no US bank corridor.
    if (!SEPA_MEMBERS.has(iso2)) return undefined
    return DEPOSIT_RAIL_ORDER.find((corridor) => {
        const rail = DEPOSIT_RAILS[corridor]
        return ZONE_FLAGS.has(rail.flagIso2) && rail.currency === currency
    })
}
