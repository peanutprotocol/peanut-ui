import { type MetadataRoute } from 'next'
import { BASE_URL } from '@/constants/general.consts'
import {
    COUNTRIES_SEO,
    CORRIDORS,
    RECEIVE_SOURCES,
    COMPETITORS,
    EXCHANGES,
    DEPOSIT_RAILS,
    PAYMENT_METHOD_SLUGS,
} from '@/data/seo'
import { SUPPORTED_LOCALES } from '@/i18n/config'
import {
    contentGeneratedAt,
    hasCorridorContent,
    hasPageContent,
    hasSingletonContent,
    listContentSlugs,
    listPublishedSlugs,
    readCorridorContent,
    readPageContent,
    readSingletonContent,
    type ContentFrontmatter,
} from '@/lib/content'

// TODO (infra): Update GitHub org, Twitter bio, LinkedIn, npm package.json → peanut.me
// TODO (GA4): Create data filter to exclude trafficheap.com referral traffic

/** Build date used for non-content pages that don't have their own date. */
const BUILD_DATE = new Date()

/** Card legal pages — indexable, so they belong in the sitemap alongside /privacy and /terms. */
const CARD_LEGAL_SLUGS = [
    'card-esign',
    'card-privacy',
    'card-prohibited-activities',
    'card-terms-international',
    'card-terms-us',
] as const

// --- lastmod sources ---
// Content-backed URLs report the `generated_at` of the exact file that serves them, so a
// rebuild no longer bumps every lastmod to the deploy timestamp. These read through the same
// cache the has*Content() guards already populate, so they cost no extra file reads.
// Each returns undefined when the file is missing or carries no usable date, in which case
// the caller falls back to BUILD_DATE — that covers the hand-built pages (homepage, /shhhhh,
// /careers) and the index pages that aren't backed by a single file.

const pageDate = (intent: string, slug: string, locale: string): Date | undefined =>
    contentGeneratedAt(readPageContent<ContentFrontmatter>(intent, slug, locale))

const corridorDate = (destination: string, origin: string, locale: string): Date | undefined =>
    contentGeneratedAt(readCorridorContent<ContentFrontmatter>(destination, origin, locale))

const singletonDate = (intent: string, locale: string): Date | undefined =>
    contentGeneratedAt(readSingletonContent<ContentFrontmatter>(intent, locale))

async function generateSitemap(): Promise<MetadataRoute.Sitemap> {
    type SitemapEntry = {
        path: string
        priority: number
        changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency']
        lastModified?: Date
    }

    const pages: SitemapEntry[] = [
        // Homepage
        { path: '', priority: 1.0, changeFrequency: 'weekly' },

        // Public pages
        { path: '/careers', priority: 0.7, changeFrequency: 'monthly' },
        // The only card landing URL left — /lp/card is a 308 to it, so the
        // target has to be listed.
        { path: '/shhhhh', priority: 0.7, changeFrequency: 'weekly' },

        // Legal — the bare /privacy and /terms are redirects; list the real URLs.
        { path: '/en/privacy', priority: 0.5, changeFrequency: 'yearly' },
        { path: '/en/terms', priority: 0.5, changeFrequency: 'yearly' },

        // Card legal — same content-existence guard as every other content URL:
        // only locales that own the prose are listed (today: en).
        ...SUPPORTED_LOCALES.flatMap((locale) =>
            CARD_LEGAL_SLUGS.filter((slug) => hasPageContent('legal', slug, locale)).map((slug) => ({
                path: `/${locale}/${slug}`,
                priority: 0.5,
                changeFrequency: 'yearly' as const,
                lastModified: pageDate('legal', slug, locale),
            }))
        ),
    ]

    // --- Programmatic SEO pages (all locales with /{locale}/ prefix) ---
    for (const locale of SUPPORTED_LOCALES) {
        const isDefault = locale === 'en'
        const basePriority = isDefault ? 1.0 : 0.9 // EN gets slightly higher priority

        // Localized landing page (English lives at '/', already listed above)
        if (!isDefault) {
            pages.push({ path: `/${locale}`, priority: 1.0 * basePriority, changeFrequency: 'weekly' })
        }

        // Country hub pages
        for (const country of Object.keys(COUNTRIES_SEO)) {
            if (!hasPageContent('countries', country, locale)) continue
            pages.push({
                path: `/${locale}/${country}`,
                priority: 0.9 * basePriority,
                changeFrequency: 'weekly',
                lastModified: pageDate('countries', country, locale),
            })
        }

        // Send-money-to country pages
        for (const country of Object.keys(COUNTRIES_SEO)) {
            if (!hasPageContent('send-to', country, locale)) continue
            pages.push({
                path: `/${locale}/send-money-to/${country}`,
                priority: 0.8 * basePriority,
                changeFrequency: 'weekly',
                lastModified: pageDate('send-to', country, locale),
            })
        }

        // From-to corridor pages
        for (const corridor of CORRIDORS) {
            if (!hasCorridorContent(corridor.to, corridor.from, locale)) continue
            pages.push({
                path: `/${locale}/send-money-from/${corridor.from}/to/${corridor.to}`,
                priority: 0.85 * basePriority,
                changeFrequency: 'weekly',
                lastModified: corridorDate(corridor.to, corridor.from, locale),
            })
        }

        // Receive money pages — every published receive-from article (independent of corridors)
        for (const source of RECEIVE_SOURCES) {
            if (!hasPageContent('receive-from', source, locale)) continue
            pages.push({
                path: `/${locale}/receive-money-from/${source}`,
                priority: 0.7 * basePriority,
                changeFrequency: 'weekly',
                lastModified: pageDate('receive-from', source, locale),
            })
        }

        // Comparison pages
        for (const slug of Object.keys(COMPETITORS)) {
            if (!hasPageContent('compare', slug, locale)) continue
            pages.push({
                path: `/${locale}/compare/peanut-vs-${slug}`,
                priority: 0.7 * basePriority,
                changeFrequency: 'monthly',
                lastModified: pageDate('compare', slug, locale),
            })
        }

        // Deposit pages (exchanges + rails)
        for (const exchange of Object.keys(EXCHANGES)) {
            // With no MDX at all the page builds from i18n copy (localized for
            // every locale); with an en file, a missing locale file serves the
            // English MDX, so only locales with their own file are listed.
            if (hasPageContent('deposit', exchange, 'en') && !hasPageContent('deposit', exchange, locale)) continue
            pages.push({
                path: `/${locale}/deposit/from-${exchange}`,
                priority: 0.7 * basePriority,
                changeFrequency: 'monthly',
                // Undefined for the i18n-only exchanges (no MDX at all) → BUILD_DATE.
                lastModified: pageDate('deposit', exchange, locale),
            })
        }
        for (const rail of Object.keys(DEPOSIT_RAILS)) {
            if (!hasPageContent('deposit', rail, locale)) continue
            pages.push({
                path: `/${locale}/deposit/via-${rail}`,
                priority: 0.7 * basePriority,
                changeFrequency: 'monthly',
                lastModified: pageDate('deposit', rail, locale),
            })
        }

        // Pay-with pages
        for (const method of PAYMENT_METHOD_SLUGS) {
            if (!hasPageContent('pay-with', method, locale)) continue
            pages.push({
                path: `/${locale}/pay-with/${method}`,
                priority: 0.7 * basePriority,
                changeFrequency: 'monthly',
                lastModified: pageDate('pay-with', method, locale),
            })
        }

        // Help center
        pages.push({
            path: `/${locale}/help`,
            priority: 0.7 * basePriority,
            changeFrequency: 'weekly',
        })
        for (const slug of listContentSlugs('help')) {
            if (!hasPageContent('help', slug, locale)) continue
            pages.push({
                path: `/${locale}/help/${slug}`,
                priority: 0.6 * basePriority,
                changeFrequency: 'monthly',
                lastModified: pageDate('help', slug, locale),
            })
        }

        // Use cases
        for (const slug of listPublishedSlugs('use-cases')) {
            if (!hasPageContent('use-cases', slug, locale)) continue
            pages.push({
                path: `/${locale}/use-cases/${slug}`,
                priority: 0.7 * basePriority,
                changeFrequency: 'monthly',
                lastModified: pageDate('use-cases', slug, locale),
            })
        }

        // User stories
        for (const slug of listPublishedSlugs('stories')) {
            if (slug === 'index') continue
            if (!hasPageContent('stories', slug, locale)) continue
            pages.push({
                path: `/${locale}/stories/${slug}`,
                priority: 0.6 * basePriority,
                changeFrequency: 'monthly',
                lastModified: pageDate('stories', slug, locale),
            })
        }
        // Stories index
        pages.push({
            path: `/${locale}/stories`,
            priority: 0.5 * basePriority,
            changeFrequency: 'monthly',
        })

        // Withdraw pages
        for (const slug of listPublishedSlugs('withdraw')) {
            if (!hasPageContent('withdraw', slug, locale)) continue
            pages.push({
                path: `/${locale}/withdraw/${slug}`,
                priority: 0.6 * basePriority,
                changeFrequency: 'monthly',
                lastModified: pageDate('withdraw', slug, locale),
            })
        }

        // Supported networks
        if (hasSingletonContent('supported-networks', locale)) {
            pages.push({
                path: `/${locale}/supported-networks`,
                priority: 0.6 * basePriority,
                changeFrequency: 'monthly',
                lastModified: singletonDate('supported-networks', locale),
            })
        }

        // Pricing
        if (hasSingletonContent('pricing', locale)) {
            pages.push({
                path: `/${locale}/pricing`,
                priority: 0.7 * basePriority,
                changeFrequency: 'monthly',
                lastModified: singletonDate('pricing', locale),
            })
        }

        // Content hub + blog posts. There is no blog index URL any more —
        // /{locale}/blog is a 308 to /{locale}/content, which already lists the
        // same posts behind its Blog filter. The posts themselves stay.
        pages.push({
            path: `/${locale}/content`,
            priority: 0.7 * basePriority,
            changeFrequency: 'weekly',
        })
        for (const slug of listContentSlugs('blog')) {
            if (slug === 'index') continue
            if (!hasPageContent('blog', slug, locale)) continue
            pages.push({
                path: `/${locale}/blog/${slug}`,
                priority: 0.6 * basePriority,
                changeFrequency: 'monthly',
                lastModified: pageDate('blog', slug, locale),
            })
        }

        // Team pages excluded from production sitemap (not yet launched)
    }

    return pages.map((page) => ({
        url: `${BASE_URL}${page.path}`,
        lastModified: page.lastModified ?? BUILD_DATE,
        changeFrequency: page.changeFrequency,
        priority: page.priority,
    }))
}

export default generateSitemap
