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

/** key under `provider.label`: what the row calls the provider on a given screen */
export type ProviderLabel = 'provider' | 'accountProvider' | 'cardIssuer'

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
    /** the document's own title, for a link that names it ("Bridge EEA user terms") */
    termsName?: string
    privacyUrl?: string
}
