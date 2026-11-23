export type ProviderId =
    | 'bridge-us'
    | 'bridge-eea'
    | 'bridge-row'
    | 'bridge'
    | 'manteca-ar'
    | 'manteca-br'
    | 'avenia-br'
    | 'rhino'
    | 'third-national'

// key under `provider.role` and `provider.execution` in the app catalogs
export type ProviderRole = 'bridge' | 'bridgeEea' | 'mantecaAr' | 'mantecaBr' | 'aveniaBr' | 'rhino' | 'thirdNational'

/** key under `provider.termsName`: the title of the provider's terms document */
export type ProviderTermsName = 'bridgeUs' | 'bridgeEea' | 'bridgeRow' | 'bridge' | 'aveniaBr'

/** key under `provider.label`: what the row calls the provider on a given screen */
export type ProviderLabel = 'provider' | 'accountProvider' | 'cardProvider'

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
    /** picks the role and "how it works" copy in the sheet */
    role: ProviderRole
    programManager?: string
    /** true when the user accepted this provider's own terms, so the sheet can say they deal with it directly */
    userContract: boolean
    termsUrl?: string
    /** the document's own title, as a key under `provider.termsName`, for a link that names it */
    termsName?: ProviderTermsName
    privacyUrl?: string
    support?: string
    /**
     * The API's provider code this entry answers for, as routes ('avenia') and history rows
     * ('AVENIA') name it, compared without case; with `currency` where one provider runs an entity
     * per currency (Manteca: ARS, BRL). An entry without it is never picked from a code: Bridge's
     * residence entities are picked by residence instead.
     */
    answersFor?: { provider: string; currency?: string }
}
