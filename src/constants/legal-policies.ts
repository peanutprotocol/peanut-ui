/** i18n keys under profile.about.policies */
export type PolicyKey =
    | 'terms'
    | 'privacy'
    | 'cardTermsUs'
    | 'cardTermsInternational'
    | 'cardEsign'
    | 'cardPrivacy'
    | 'cardProhibitedActivities'
    | 'securityDisclosure'

export interface LegalPolicy {
    key: PolicyKey
    /** consent-ledger document slug (GET /users/consent/status) */
    slug: string
    /** app-relative path; DocsLink localizes `/en/…` and opens web-only routes safely */
    href: string
}

/**
 * Every policy reachable from inside the app: the About screen lists all of
 * them, the re-consent modal names the outdated ones by slug. Labels live in
 * the catalogs so the document names follow the app language.
 */
export const LEGAL_POLICIES: readonly LegalPolicy[] = [
    { key: 'terms', slug: 'terms', href: '/terms' },
    { key: 'privacy', slug: 'privacy', href: '/privacy' },
    { key: 'cardTermsUs', slug: 'card-terms-us', href: '/card-terms-us' },
    { key: 'cardTermsInternational', slug: 'card-terms-international', href: '/card-terms-international' },
    { key: 'cardEsign', slug: 'card-esign', href: '/card-esign' },
    { key: 'cardPrivacy', slug: 'card-privacy', href: '/card-privacy' },
    { key: 'cardProhibitedActivities', slug: 'card-prohibited-activities', href: '/card-prohibited-activities' },
    { key: 'securityDisclosure', slug: 'security-disclosure', href: '/en/help/security-disclosure' },
]

export const legalPolicyForSlug = (slug: string): LegalPolicy | undefined =>
    LEGAL_POLICIES.find((policy) => policy.slug === slug)
