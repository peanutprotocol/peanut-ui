import Link from 'next/link'
import manifest from '@/content/generated/footer-manifest.json'
import { getTranslations, t } from '@/i18n'
import { DEFAULT_LOCALE, type Locale, type Translations } from '@/i18n/types'

// SEO footer driven by the content manifest (peanut-content/generated/footer-manifest.json).
// Data is imported as a JSON module — works in both client and server components
// without fs. The manifest is bundled at build time by webpack.

interface ManifestEntry {
    slug: string
    name: string
    href: string
    external?: boolean
}

function localizeHref(href: string, locale: Locale): string {
    if (href.startsWith('/en/')) return `/${locale}/${href.slice(4)}`
    return href
}

function FooterSection({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div>
            <h3 className="mb-3 text-xs font-bold text-white">{title}</h3>
            <ul className="space-y-1">{children}</ul>
        </div>
    )
}

/**
 * Manifest "resources" entries that now live elsewhere in the footer, so the
 * remainder can be folded into "Learn More" without duplicating a link:
 *  - terms → a stale Notion export, superseded by the /terms page in Legal below
 *  - jobs  → already a top-level link in the footer nav above
 */
const RESOURCES_MOVED_ELSEWHERE = new Set(['terms', 'jobs'])

/**
 * Every published legal document, in the order a reader needs them: the two
 * that bind all users first, then the card-programme docs. Card applicants see
 * these inline at signing time (CardTermsScreen), but app-store review and the
 * issuer both expect them permanently reachable, which is what this column is.
 * Hrefs are authored `/en/…` and localized by `localizeHref` like the manifest
 * entries; the marketing pages fall back to English prose when a translation
 * is missing, so a localized URL is always safe.
 */
const LEGAL_LINKS: Array<{ slug: string; href: string; label: (i18n: Translations) => string }> = [
    { slug: 'terms', href: '/en/terms', label: (i18n) => i18n.footerTerms },
    { slug: 'privacy', href: '/en/privacy', label: (i18n) => i18n.footerPrivacy },
    { slug: 'card-terms-us', href: '/en/card-terms-us', label: (i18n) => i18n.footerCardTermsUs },
    {
        slug: 'card-terms-international',
        href: '/en/card-terms-international',
        label: (i18n) => i18n.footerCardTermsInternational,
    },
    { slug: 'card-esign', href: '/en/card-esign', label: (i18n) => i18n.footerCardEsign },
    { slug: 'card-privacy', href: '/en/card-privacy', label: (i18n) => i18n.footerCardPrivacy },
    {
        slug: 'card-prohibited-activities',
        href: '/en/card-prohibited-activities',
        label: (i18n) => i18n.footerCardProhibitedActivities,
    },
]

function FooterLink({ href, external, children }: { href: string; external?: boolean; children: React.ReactNode }) {
    if (external) {
        return (
            <li>
                <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-white underline hover:text-white/70"
                >
                    {children}
                </a>
            </li>
        )
    }
    return (
        <li>
            {/* prefetch={false}: Next prefetches every Link in the viewport, and this
            footer maps over dozens of country/route pages. Prefetching an app
            route also pulls its client chunks, which is how the wallet bundle and
            the Sentry SDK were arriving on the landing page after being removed
            from its own graph. Navigation fetches on click instead. */}
            <Link prefetch={false} href={href} className="text-xs text-white underline hover:text-white/70">
                {children}
            </Link>
        </li>
    )
}

export function SEOFooter({ locale = DEFAULT_LOCALE }: { locale?: Locale } = {}) {
    const i18n = getTranslations(locale)
    const sendTo = (manifest.sendMoney?.to ?? []) as ManifestEntry[]
    const sendFrom = (manifest.sendMoney?.from ?? []) as ManifestEntry[]
    const compare = (manifest.compare ?? []) as ManifestEntry[]
    const articles = ((manifest as Record<string, unknown>).articles ?? []) as ManifestEntry[]
    const resources = (manifest.resources ?? []) as ManifestEntry[]
    const hasSendMoney = sendTo.length > 0 || sendFrom.length > 0
    // What's left of "Resources" rides on top of "Learn More" — the column
    // itself is gone, its slot in the 4-up grid taken by Legal.
    const learnMoreResources = resources.filter((entry) => !RESOURCES_MOVED_ELSEWHERE.has(entry.slug))

    const link = (entry: ManifestEntry) => (entry.external ? entry.href : localizeHref(entry.href, locale))

    return (
        <nav aria-label={i18n.footerSiteDirectory} className="bg-black px-8 py-8 pb-24 md:px-20 md:pb-8">
            <div className="grid grid-cols-2 gap-x-6 gap-y-8 md:grid-cols-4">
                {hasSendMoney && (
                    <FooterSection title={i18n.sendMoney}>
                        {sendTo.map((entry) => (
                            <FooterLink key={`to-${entry.slug}`} href={link(entry)}>
                                {t(i18n.footerSendTo, { name: entry.name })}
                            </FooterLink>
                        ))}
                        {sendFrom.map((entry) => (
                            <FooterLink key={`from-${entry.slug}`} href={link(entry)}>
                                {t(i18n.footerSendFrom, { name: entry.name })}
                            </FooterLink>
                        ))}
                    </FooterSection>
                )}

                {compare.length > 0 && (
                    <FooterSection title={i18n.footerCompare}>
                        {compare.map((entry) => (
                            <FooterLink key={entry.slug} href={link(entry)}>
                                {t(i18n.footerPeanutVs, { name: entry.name })}
                            </FooterLink>
                        ))}
                    </FooterSection>
                )}

                {(articles.length > 0 || learnMoreResources.length > 0) && (
                    <FooterSection title={i18n.footerLearnMoreSection}>
                        {learnMoreResources.map((entry) => (
                            <FooterLink key={`resource-${entry.slug}`} href={link(entry)} external={entry.external}>
                                {entry.name}
                            </FooterLink>
                        ))}
                        {articles.map((entry) => (
                            <FooterLink key={entry.slug} href={link(entry)}>
                                {entry.name}
                            </FooterLink>
                        ))}
                    </FooterSection>
                )}

                <FooterSection title={i18n.footerLegalSection}>
                    {LEGAL_LINKS.map((entry) => (
                        <FooterLink key={entry.slug} href={localizeHref(entry.href, locale)}>
                            {entry.label(i18n)}
                        </FooterLink>
                    ))}
                </FooterSection>
            </div>
        </nav>
    )
}
