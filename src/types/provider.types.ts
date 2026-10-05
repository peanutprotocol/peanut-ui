export type ProviderId =
    | 'bridge-us'
    | 'bridge-eea'
    | 'bridge-row'
    | 'bridge'
    | 'manteca-ar'
    | 'manteca-br'
    | 'rhino'
    | 'third-national'
    | 'sumsub'

// key under `provider.role` in the app catalogs
export type ProviderRole = 'bridge' | 'manteca' | 'rhino' | 'thirdNational' | 'sumsub'

/**
 * One legal entity behind a provider brand. Optional fields are left out when
 * the fact is not verified, so the sheet never prints a guess.
 */
export interface ProviderRecord {
    id: ProviderId
    brand: string
    legalName?: string
    registeredOffice?: string[]
    registration?: string
    regulator?: string
    role: ProviderRole
    /** true when the user accepted this provider's own terms, so the sheet can say they deal with it directly */
    userContract: boolean
    termsUrl?: string
    privacyUrl?: string
}

/** key under `provider.finePrint`: the sentence before "About <brand>" */
export type ProviderFinePrint =
    | 'bankTransfers'
    | 'payments'
    | 'crossChain'
    | 'card'
    | 'sendsTransfer'
    | 'sentTransfer'
    | 'account'
