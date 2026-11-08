export interface ResidenceRestrictionSets {
    full: ReadonlySet<string>
    cardOnly: ReadonlySet<string>
    bankingOnly: ReadonlySet<string>
    refusedIdIssuers: ReadonlySet<string>
    bankingNewCustomersOnly: ReadonlySet<string>
}

// The lists change with API deploys, not with users: one answer per session, shared by every hook.
let serverSets: ResidenceRestrictionSets | null = null

export const getResidenceRestrictionSets = (): ResidenceRestrictionSets | null => serverSets

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
    const refusedSet = toSet(refusedIdIssuers)
    const newCustomersSet = toSet(bankingNewCustomersOnly)
    if (!refusedSet || !newCustomersSet) return null
    return {
        full: fullSet,
        cardOnly: cardSet,
        bankingOnly: bankingSet,
        refusedIdIssuers: refusedSet,
        bankingNewCustomersOnly: newCustomersSet,
    }
}

export const setServerResidenceRestrictionSets = (sets: ResidenceRestrictionSets | null) => {
    serverSets = sets
}
