import {
    BANKING_RESTRICTED_RESIDENCE_ISO2,
    CARD_RESTRICTED_RESIDENCE_ISO2,
    RESTRICTED_RESIDENCE_ISO2,
    REFUSED_ID_ISSUER_ISO2,
    BANKING_NEW_CUSTOMERS_ONLY_RESIDENCE_ISO2,
} from '@/constants/residence.consts'

export interface ResidenceRestrictionSets {
    full: ReadonlySet<string>
    cardOnly: ReadonlySet<string>
    bankingOnly: ReadonlySet<string>
    refusedIdIssuers: ReadonlySet<string>
    bankingNewCustomersOnly: ReadonlySet<string>
}

/** Bundled mirror — the offline/pre-fetch fallback, never the source of truth. */
export const LOCAL_RESIDENCE_RESTRICTION_SETS: ResidenceRestrictionSets = {
    full: RESTRICTED_RESIDENCE_ISO2,
    cardOnly: CARD_RESTRICTED_RESIDENCE_ISO2,
    bankingOnly: BANKING_RESTRICTED_RESIDENCE_ISO2,
    refusedIdIssuers: REFUSED_ID_ISSUER_ISO2,
    bankingNewCustomersOnly: BANKING_NEW_CUSTOMERS_ONLY_RESIDENCE_ISO2,
}

// Module-level cache: the lists change with API deploys, not with users, so one
// fetch per session is plenty and every hook instance shares it.
let serverSets: ResidenceRestrictionSets | null = null

export const getResidenceRestrictionSets = (): ResidenceRestrictionSets =>
    serverSets ?? LOCAL_RESIDENCE_RESTRICTION_SETS

export const parseResidenceRestrictionSets = (json: unknown): ResidenceRestrictionSets | null => {
    if (!json || typeof json !== 'object') return null
    const { full, cardOnly, bankingOnly, refusedIdIssuers, bankingNewCustomersOnly } = json as Record<string, unknown>
    const toSet = (value: unknown): ReadonlySet<string> | null =>
        Array.isArray(value) && value.every((v) => typeof v === 'string')
            ? new Set(value.map((v) => v.toUpperCase()))
            : null
    const fullSet = toSet(full)
    const cardSet = toSet(cardOnly)
    const bankingSet = toSet(bankingOnly)
    if (!fullSet || !cardSet || !bankingSet) return null
    const refusedSet =
        refusedIdIssuers === undefined ? LOCAL_RESIDENCE_RESTRICTION_SETS.refusedIdIssuers : toSet(refusedIdIssuers)
    const newCustomersSet =
        bankingNewCustomersOnly === undefined
            ? LOCAL_RESIDENCE_RESTRICTION_SETS.bankingNewCustomersOnly
            : toSet(bankingNewCustomersOnly)
    if (!refusedSet || !newCustomersSet) return null
    return {
        full: fullSet,
        cardOnly: cardSet,
        bankingOnly: bankingSet,
        refusedIdIssuers: refusedSet,
        bankingNewCustomersOnly: newCustomersSet,
    }
}

export const serverResidenceRestrictionSets = (): ResidenceRestrictionSets | null => serverSets

export const setServerResidenceRestrictionSets = (sets: ResidenceRestrictionSets | null) => {
    serverSets = sets
}
