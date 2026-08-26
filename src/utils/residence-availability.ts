import { deriveResidenceRestrictionsFrom } from '@/hooks/useResidenceRestrictions'
import { type ResidenceRestrictionSets } from '@/hooks/useResidenceRestrictionSets'
import { isBridgeSupportedCountry } from '@/utils/regions.utils'

/** i18n keys under setup.residenceStep.compare.items */
export type AvailabilityItemKey = 'p2p' | 'pix' | 'arQr' | 'spei' | 'achWire' | 'sepa' | 'bank' | 'card'

export interface ResidenceAvailability {
    iso2: string
    /** what this residence makes available, always led by the universal P2P layer */
    available: AvailabilityItemKey[]
    /** what this residence rules out, from the restriction tiers */
    unavailable: Array<'banking' | 'card'>
}

/**
 * Per-country availability summary for the dual-residence comparison at
 * signup. Client-side on purpose: the tiers arrive via the restriction-sets
 * hook (server lists with the bundled mirror as fallback) and the
 * country-to-rails mapping is the same static knowledge Unlock payments
 * renders, so the comparison needs no backend. Informational only, and it
 * never overstates: rest-of-world bank rails read as "where supported".
 */
export function residenceAvailability(sets: ResidenceRestrictionSets, iso2: string): ResidenceAvailability {
    const code = iso2.toUpperCase()
    const restrictions = deriveResidenceRestrictionsFrom(sets, code)
    const available: AvailabilityItemKey[] = ['p2p']
    const unavailable: Array<'banking' | 'card'> = []

    if (restrictions.banking) {
        unavailable.push('banking')
    } else if (code === 'BR') available.push('pix')
    else if (code === 'AR') available.push('arQr')
    else if (code === 'MX') available.push('spei')
    else if (code === 'US') available.push('achWire')
    else if (isBridgeSupportedCountry(code)) available.push('sepa')
    else available.push('bank')

    if (restrictions.card) unavailable.push('card')
    else available.push('card')

    return { iso2: code, available, unavailable }
}
