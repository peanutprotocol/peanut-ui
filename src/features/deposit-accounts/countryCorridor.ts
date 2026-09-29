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
 * Which deposit corridors a country belongs to, in catalogue order.
 *
 * Brazil has two and they are different products: a standing Pix account
 * somebody else can pay into, and a one-off Pix code for the user's own
 * top-up. Returning both is what lets the country selector offer the choice
 * instead of silently picking one.
 *
 * Read entirely from `DEPOSIT_RAILS`, so a corridor added there is routable
 * here without a second table to remember. That is the point: the add-money
 * country pick and the get-paid list now answer "what does this corridor do"
 * from one place, and a country whose corridor is not a standing account
 * follows the same rail's `topUpHref` to the flow that is.
 */
export function corridorsForCountry(country: Pick<CountryData, 'type' | 'iso2' | 'currency'>): DepositCorridor[] {
    if (country.type !== 'country') return []

    const iso2 = country.iso2?.toUpperCase()
    const currency = country.currency?.toUpperCase()
    if (!iso2) return []

    const byCountry = DEPOSIT_RAIL_ORDER.filter((corridor) => {
        const rail = DEPOSIT_RAILS[corridor]
        return !ZONE_FLAGS.has(rail.flagIso2) && rail.flagIso2.toUpperCase() === iso2
    })
    if (byCountry.length > 0) return byCountry

    // A zone rail serves a named membership, so the currency alone is not
    // enough: Ecuador prices in dollars and has no US bank corridor.
    if (!SEPA_MEMBERS.has(iso2)) return []
    return DEPOSIT_RAIL_ORDER.filter((corridor) => {
        const rail = DEPOSIT_RAILS[corridor]
        return ZONE_FLAGS.has(rail.flagIso2) && rail.currency === currency
    })
}

/** the corridor a country leads to first, in catalogue order */
export function corridorForCountry(
    country: Pick<CountryData, 'type' | 'iso2' | 'currency'>
): DepositCorridor | undefined {
    return corridorsForCountry(country)[0]
}
