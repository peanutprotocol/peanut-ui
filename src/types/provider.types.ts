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
    termsUrl?: string
    privacyUrl?: string
}

export type ProviderRowLabel = 'provider' | 'accountProvider' | 'cardIssuer'
