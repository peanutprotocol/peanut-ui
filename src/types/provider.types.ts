export type ProviderId =
    | 'bridge-us'
    | 'bridge-eea'
    | 'bridge-row'
    | 'bridge'
    | 'manteca-ar'
    | 'manteca-br'
    | 'rhino'
    | 'third-national'

// key under `provider.role` and `provider.execution` in the app catalogs
export type ProviderRole = 'bridge' | 'bridgeEea' | 'mantecaAr' | 'mantecaBr' | 'rhino' | 'thirdNational'

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
    taxId?: string
    regulator?: string
    /** picks the role and "how this executes" copy in the sheet */
    role: ProviderRole
    programManager?: string
    /** true when the user accepted this provider's own terms, so the sheet can say they deal with it directly */
    userContract: boolean
    termsUrl?: string
    /** the document's own title, for a link that names it ("Bridge EEA user terms") */
    termsName?: string
    privacyUrl?: string
    support?: string
}
