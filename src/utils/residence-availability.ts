import { deriveResidenceRestrictionsFrom } from '@/hooks/useResidenceRestrictions'
import { type ResidenceRestrictionSets } from '@/hooks/useResidenceRestrictionSets'
import { regionIntentForResidence } from '@/utils/regions.utils'
import { type KYCRegionIntent } from '@/app/actions/types/sumsub.types'

/** i18n keys under setup.residenceStep.compare.items */
export type AvailabilityItemKey = 'p2p' | 'pix' | 'arQr' | 'spei' | 'usdAch' | 'eurSepa' | 'gbpFps' | 'bank' | 'card'

export type AvailabilityRailKey = Exclude<AvailabilityItemKey, 'p2p' | 'card' | 'bank'>

export interface ResidenceAvailability {
    iso2: string
    /** what this residence makes available, always led by the universal P2P layer */
    available: AvailabilityItemKey[]
    /** what this residence rules out, from the restriction tiers */
    unavailable: Array<'banking' | 'card'>
    /**
     * Whether `available` spans more than one currency, so the card can qualify
     * the extras rather than promise them all as residence benefits.
     */
    multiCurrency: boolean
}

/**
 * Which rails a residence's verification actually enrols, keyed by the intent
 * `regionIntentForResidence` routes that residence to. FE mirror of
 * peanut-api-ts `REGION_RAIL_MAP` (src/kyc/rails.consts.ts): EU and NA both
 * enrol the whole Bridge set from one verification, LATAM enrols the Manteca
 * QR pool, ROW enrols no bank rail at all.
 *
 * Deriving the signup promise from the intent — rather than from "is this
 * country in the Bridge map" — keeps it scoped to the residence by
 * construction: a UK, sanctioned or Bridge-unserved residence maps to ROW and
 * can never be told about a rail its verification would not open.
 *
 * Two deliberate narrowings of REGION_RAIL_MAP, both because the provider
 * issues the account to one residence only: SPEI_MX (Bridge mints MXN
 * accounts for Mexican residents) and the LATAM QR rails (Manteca onboards
 * BR and AR one country each). They are listed via HOME_RAIL instead.
 */
const BRIDGE_RAILS: readonly AvailabilityRailKey[] = ['eurSepa', 'gbpFps', 'usdAch']

const INTENT_RAILS: Readonly<Record<KYCRegionIntent, readonly AvailabilityRailKey[]>> = {
    STANDARD: BRIDGE_RAILS,
    EU: BRIDGE_RAILS,
    NA: BRIDGE_RAILS,
    LATAM: [],
    ROW: [],
}

/**
 * The residence's own-currency rail, listed first — what the user pays and gets
 * paid in at home. The static intent map is the conservative floor; the
 * server-provided restriction tiers gate above it in `residenceAvailability`,
 * so a residence the server restricts lists nothing whatever this map says.
 */
const HOME_RAIL: Readonly<Record<string, AvailabilityRailKey>> = {
    BR: 'pix',
    AR: 'arQr',
    MX: 'spei',
    US: 'usdAch',
}

const RAIL_CURRENCY: Readonly<Record<AvailabilityRailKey, string>> = {
    pix: 'BRL',
    arQr: 'ARS',
    spei: 'MXN',
    usdAch: 'USD',
    eurSepa: 'EUR',
    gbpFps: 'GBP',
}

/**
 * True when the residence's set spans more than one currency. One verification
 * really does enrol all of them, but a rail outside the user's own currency
 * only pays out into an account on that network — so the comparison card
 * states that as a condition instead of listing the extras as flat benefits of
 * living there. Deliberately currency-level, not "which one is home": naming a
 * home currency per residence would need a eurozone taxonomy the app has no
 * other use for, and gets Portugal-vs-Poland wrong the moment it drifts.
 */
export function spansMultipleCurrencies(rails: readonly AvailabilityItemKey[]): boolean {
    const currencies = new Set(rails.map((rail) => RAIL_CURRENCY[rail as AvailabilityRailKey]).filter(Boolean))
    return currencies.size > 1
}

export function bankRailsFor(iso2: string): AvailabilityItemKey[] {
    const code = iso2.toUpperCase()
    const home = HOME_RAIL[code]
    const rails: AvailabilityItemKey[] = home ? [home] : []
    for (const rail of INTENT_RAILS[regionIntentForResidence(code)]) if (rail !== home) rails.push(rail)
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

    return { iso2: code, available, unavailable, multiCurrency: spansMultipleCurrencies(available) }
}
