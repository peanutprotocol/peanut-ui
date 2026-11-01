import { deriveResidenceRestrictionsFrom } from '@/utils/residence-restrictions'
import { type ResidenceRestrictionSets } from '@/hooks/useResidenceRestrictionSets'
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

export function bankRailsFor(_iso2: string): AvailabilityItemKey[] {
    return ['bank']
}

const BANK_CURRENCY_RAIL: Readonly<Record<string, AvailabilityRailKey>> = {
    USD: 'usdAch',
    EUR: 'eurSepa',
    GBP: 'gbpFps',
    MXN: 'spei',
}
const LOCAL_FEATURE_RAIL: Readonly<Record<string, AvailabilityRailKey>> = { BR: 'pix', AR: 'arQr' }

function railsFromIntents(code: string, intents: KycIntents): AvailabilityItemKey[] {
    const rails: AvailabilityItemKey[] = []
    if (intents.local.available && LOCAL_FEATURE_RAIL[code]) rails.push(LOCAL_FEATURE_RAIL[code])
    if (intents.bank.available) {
        const initialCount = rails.length
        for (const currency of intents.bank.currencies ?? []) {
            const rail = Object.prototype.hasOwnProperty.call(BANK_CURRENCY_RAIL, currency)
                ? BANK_CURRENCY_RAIL[currency]
                : undefined
            if (rail && !rails.includes(rail)) rails.push(rail)
        }
        if (rails.length === initialCount) rails.push('bank')
    }
    return rails
}

/**
 * Per-country availability summary for the dual-residence comparison at
 * signup. With `intents` (GET /config/kyc-intents) it says exactly what the
 * verification will offer that residence: the local rail when the local
 * feature is open, Bridge's accounts when the bank one is, the card when Rain
 * takes it. Without them (the read failed) it falls back to the restriction
 * tiers without naming currencies. Informational only.
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
        else available.push('bank')
        if (restrictions.card) unavailable.push('card')
        else available.push('card')
    }

    available.push('p2p')

    return { iso2: code, available, unavailable, multiCurrency: spansMultipleCurrencies(available) }
}
