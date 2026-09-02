import { deriveResidenceRestrictionsFrom } from '@/hooks/useResidenceRestrictions'
import { type ResidenceRestrictionSets } from '@/hooks/useResidenceRestrictionSets'
import { isBridgeSupportedCountry } from '@/utils/regions.utils'

/** i18n keys under setup.residenceStep.compare.items */
export type AvailabilityItemKey = 'p2p' | 'pix' | 'arQr' | 'spei' | 'usdAch' | 'eurSepa' | 'gbpFps' | 'bank' | 'card'

export type AvailabilityRailKey = Exclude<AvailabilityItemKey, 'p2p' | 'card' | 'bank'>

export interface ResidenceAvailability {
    iso2: string
    /** what this residence makes available, always led by the universal P2P layer */
    available: AvailabilityItemKey[]
    /** what this residence rules out, from the restriction tiers */
    unavailable: Array<'banking' | 'card'>
}

/**
 * One Bridge verification opens every Bridge virtual-account rail at once
 * (`deriveRegionAccess` unlocks Europe and North America from any functional
 * Bridge rail), so a Bridge-served residence lists the whole set, its own
 * currency first. SPEI is the exception: Bridge issues MXN accounts to Mexican
 * residents only. PIX and Argentine QR ride Manteca, which onboards BR/AR
 * residents alone — those two are not in the Bridge map.
 */
const BRIDGE_RAILS: readonly AvailabilityRailKey[] = ['eurSepa', 'gbpFps', 'usdAch']

const LOCAL_RAIL: Readonly<Record<string, AvailabilityRailKey>> = {
    BR: 'pix',
    AR: 'arQr',
    MX: 'spei',
    US: 'usdAch',
    GB: 'gbpFps',
}

export function bankRailsFor(iso2: string): AvailabilityItemKey[] {
    const code = iso2.toUpperCase()
    const local = LOCAL_RAIL[code]
    const rails: AvailabilityItemKey[] = local ? [local] : []
    if (isBridgeSupportedCountry(code)) {
        for (const rail of BRIDGE_RAILS) if (rail !== local) rails.push(rail)
    }
    // rest of world: bank rails read as "where supported", never a specific one
    return rails.length ? rails : ['bank']
}

/**
 * Per-country availability summary for the dual-residence comparison at
 * signup. Client-side on purpose: the tiers arrive via the restriction-sets
 * hook (server lists with the bundled mirror as fallback) and the
 * country-to-rails mapping is the same static knowledge Unlock payments
 * renders, so the comparison needs no backend. Informational only.
 */
export function residenceAvailability(sets: ResidenceRestrictionSets, iso2: string): ResidenceAvailability {
    const code = iso2.toUpperCase()
    const restrictions = deriveResidenceRestrictionsFrom(sets, code)
    const available: AvailabilityItemKey[] = ['p2p']
    const unavailable: Array<'banking' | 'card'> = []

    if (restrictions.banking) unavailable.push('banking')
    else available.push(...bankRailsFor(code))

    if (restrictions.card) unavailable.push('card')
    else available.push('card')

    return { iso2: code, available, unavailable }
}
