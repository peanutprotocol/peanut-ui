import { deriveResidenceRestrictionsFrom } from '@/hooks/useResidenceRestrictions'
import { type ResidenceRestrictionSets } from '@/hooks/useResidenceRestrictionSets'
import { regionIntentForResidence } from '@/utils/regions.utils'
import { type KYCRegionIntent } from '@/app/actions/types/sumsub.types'
import type { KycIntents } from '@/hooks/useKycIntents'

/** What a residence can make available: a bank rail, bank transfers where supported, the card, P2P. */
export type AvailabilityItemKey = 'p2p' | 'pix' | 'arQr' | 'spei' | 'usdAch' | 'eurSepa' | 'gbpFps' | 'bank' | 'card'

export type AvailabilityRailKey = Exclude<AvailabilityItemKey, 'p2p' | 'card' | 'bank'>

export interface ResidenceAvailability {
    iso2: string
    /** what this residence makes available, with universal P2P payments last */
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

/** The accounts Bridge opens with the bank feature: every residence it serves gets these, Mexico its own peso. */
const BANK_FEATURE_RAILS: readonly AvailabilityRailKey[] = ['usdAch', 'eurSepa', 'gbpFps']
const LOCAL_FEATURE_RAIL: Readonly<Record<string, AvailabilityRailKey>> = { BR: 'pix', AR: 'arQr' }

function railsFromIntents(code: string, intents: KycIntents): AvailabilityItemKey[] {
    const rails: AvailabilityItemKey[] = []
    if (intents.local.available && LOCAL_FEATURE_RAIL[code]) rails.push(LOCAL_FEATURE_RAIL[code])
    if (intents.bank.available) {
        const home = HOME_RAIL[code]
        if (home && !rails.includes(home) && (home === 'spei' || BANK_FEATURE_RAILS.includes(home))) rails.push(home)
        for (const rail of BANK_FEATURE_RAILS) if (!rails.includes(rail)) rails.push(rail)
    }
    return rails
}

/**
 * Per-country availability summary for the dual-residence comparison at
 * signup. With `intents` (GET /config/kyc-intents) it says exactly what the
 * verification will offer that residence: the local rail when the local
 * feature is open, Bridge's accounts when the bank one is, the card when Rain
 * takes it. Without them (the read failed) it falls back to the restriction
 * tiers and the static rail map. Informational only.
 */
export function residenceAvailability(
    sets: ResidenceRestrictionSets,
    iso2: string,
    intents?: KycIntents
): ResidenceAvailability {
    const code = iso2.toUpperCase()
    const available: AvailabilityItemKey[] = []
    const unavailable: Array<'banking' | 'card'> = []

    if (intents) {
        const rails = railsFromIntents(code, intents)
        if (rails.length) available.push(...rails)
        else unavailable.push('banking')
        if (intents.card.available) available.push('card')
        else unavailable.push('card')
    } else {
        const restrictions = deriveResidenceRestrictionsFrom(sets, code)
        if (restrictions.banking) unavailable.push('banking')
        else available.push(...bankRailsFor(code))
        if (restrictions.card) unavailable.push('card')
        else available.push('card')
    }

    available.push('p2p')

    return { iso2: code, available, unavailable, multiCurrency: spansMultipleCurrencies(available) }
}
