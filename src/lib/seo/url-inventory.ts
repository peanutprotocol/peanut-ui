import { type MetadataRoute } from 'next'
import { isGoneMarketingPath } from '@/constants/gone-routes.consts'
import { COUNTRIES_SEO, CORRIDORS, RECEIVE_SOURCES, SEND_TO_COUNTRIES } from '@/data/seo/corridors'
import { COMPETITORS } from '@/data/seo/comparisons'
import { EXCHANGES } from '@/data/seo/exchanges'
import { DEPOSIT_RAILS } from '@/data/seo/deposit-rails'
import { PAYMENT_METHOD_SLUGS } from '@/data/seo/payment-methods'
import { SUPPORTED_LOCALES } from '@/i18n/types'
import { listContentTopics } from '@/lib/content-topics'
import { isPermanentRedirectPath } from '@/lib/seo/redirects'
import { STAR_LP_ROUTES } from '@/components/Marketing/StarLp/starLp.consts'
import { MERCHANT_SLUGS } from '@/app/m/[slug]/merchants'
import {
    contentModifiedAt,
    isPublished,
    listContentSlugs,
    listPublishedSlugs,
    readCorridorContent,
    readPageContent,
    readSingletonContent,
    type ContentFrontmatter,
} from '@/lib/content'

/** Card legal pages — indexable, so they belong in the sitemap alongside /privacy and /terms. */
const CARD_LEGAL_SLUGS = [
    'card-esign',
    'card-privacy',
    'card-prohibited-activities',
    'card-terms-international',
    'card-terms-us',
] as const

const hasPublishedPageContent = (intent: string, slug: string, locale: string): boolean =>
    isPublished(readPageContent(intent, slug, locale))

const hasPublishedCorridorContent = (destination: string, origin: string, locale: string): boolean =>
    isPublished(readCorridorContent(destination, origin, locale))

const hasPublishedSingletonContent = (intent: string, locale: string): boolean =>
    isPublished(readSingletonContent(intent, locale))

// Dates belong to the exact content file, never the build that served it.
const pageDate = (intent: string, slug: string, locale: string): Date | undefined =>
    contentModifiedAt(readPageContent<ContentFrontmatter>(intent, slug, locale))

const corridorDate = (destination: string, origin: string, locale: string): Date | undefined =>
    contentModifiedAt(readCorridorContent<ContentFrontmatter>(destination, origin, locale))

const singletonDate = (intent: string, locale: string): Date | undefined =>
    contentModifiedAt(readSingletonContent<ContentFrontmatter>(intent, locale))

export interface IndexablePage {
    path: string
    priority: number
    changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency']
    lastModified?: Date
}

/** Canonical public pages shared by the sitemap, verification, submissions, and crawls. */
export function getIndexablePages(): IndexablePage[] {
    const pages: IndexablePage[] = [
        // Homepage
        { path: '/', priority: 1.0, changeFrequency: 'weekly' },

        // Public pages
        { path: '/careers', priority: 0.7, changeFrequency: 'monthly' },
        // The legacy /lp/card URL redirects here.
        { path: '/shhhhh', priority: 0.7, changeFrequency: 'weekly' },
        ...Object.values(STAR_LP_ROUTES).map((path) => ({
            path,
            priority: 0.8,
            changeFrequency: 'weekly' as const,
        })),
        ...MERCHANT_SLUGS.map((slug) => ({
            path: `/m/${slug}`,
            priority: 0.7,
            changeFrequency: 'monthly' as const,
        })),

        // Legal — the bare /privacy and /terms are redirects; list the real URLs.
        ...['privacy', 'terms']
            .filter((slug) => hasPublishedPageContent('legal', slug, 'en'))
            .map((slug) => ({
                path: `/en/${slug}`,
                priority: 0.5,
                changeFrequency: 'yearly' as const,
                lastModified: pageDate('legal', slug, 'en'),
            })),

        // Card legal — same publication guard as every other content URL:
        // only locales that own the prose are listed (today: en).
        ...SUPPORTED_LOCALES.flatMap((locale) =>
            CARD_LEGAL_SLUGS.filter((slug) => hasPublishedPageContent('legal', slug, locale)).map((slug) => ({
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

        pages.push({ path: `/${locale}/status`, priority: 0.5 * basePriority, changeFrequency: 'weekly' })

        if (hasPublishedSingletonContent('press', locale)) {
            pages.push({
                path: `/${locale}/press`,
                priority: 0.5 * basePriority,
                changeFrequency: 'monthly',
                lastModified: singletonDate('press', locale),
            })
        }

        // Country hub pages
        for (const country of Object.keys(COUNTRIES_SEO)) {
            if (!hasPublishedPageContent('countries', country, locale)) continue
            pages.push({
                path: `/${locale}/${country}`,
                priority: 0.9 * basePriority,
                changeFrequency: 'weekly',
                lastModified: pageDate('countries', country, locale),
            })
        }

        // Send-money-to country pages
        for (const country of SEND_TO_COUNTRIES) {
            if (!hasPublishedPageContent('send-to', country, locale)) continue
            pages.push({
                path: `/${locale}/send-money-to/${country}`,
                priority: 0.8 * basePriority,
                changeFrequency: 'weekly',
                lastModified: pageDate('send-to', country, locale),
            })
        }

        // From-to corridor pages
        for (const corridor of CORRIDORS) {
            if (!hasPublishedCorridorContent(corridor.to, corridor.from, locale)) continue
            pages.push({
                path: `/${locale}/send-money-from/${corridor.from}/to/${corridor.to}`,
                priority: 0.85 * basePriority,
                changeFrequency: 'weekly',
                lastModified: corridorDate(corridor.to, corridor.from, locale),
            })
        }

        // Receive money pages — every published receive-from article (independent of corridors)
        for (const source of RECEIVE_SOURCES) {
            if (!hasPublishedPageContent('receive-from', source, locale)) continue
            pages.push({
                path: `/${locale}/receive-money-from/${source}`,
                priority: 0.7 * basePriority,
                changeFrequency: 'weekly',
                lastModified: pageDate('receive-from', source, locale),
            })
        }

        // Comparison pages
        for (const slug of Object.keys(COMPETITORS)) {
            if (!hasPublishedPageContent('compare', slug, locale)) continue
            pages.push({
                path: `/${locale}/compare/peanut-vs-${slug}`,
                priority: 0.7 * basePriority,
                changeFrequency: 'monthly',
                lastModified: pageDate('compare', slug, locale),
            })
        }

        // Deposit pages (exchanges + rails)
        for (const exchange of Object.keys(EXCHANGES)) {
            if (!hasPublishedPageContent('deposit', exchange, locale)) continue
            pages.push({
                path: `/${locale}/deposit/from-${exchange}`,
                priority: 0.7 * basePriority,
                changeFrequency: 'monthly',
                lastModified: pageDate('deposit', exchange, locale),
            })
        }
        for (const rail of Object.keys(DEPOSIT_RAILS)) {
            if (!hasPublishedPageContent('deposit', rail, locale)) continue
            pages.push({
                path: `/${locale}/deposit/via-${rail}`,
                priority: 0.7 * basePriority,
                changeFrequency: 'monthly',
                lastModified: pageDate('deposit', rail, locale),
            })
        }

        // Pay-with pages
        for (const method of PAYMENT_METHOD_SLUGS) {
            if (!hasPublishedPageContent('pay-with', method, locale)) continue
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
            if (!hasPublishedPageContent('help', slug, locale)) continue
            pages.push({
                path: `/${locale}/help/${slug}`,
                priority: 0.6 * basePriority,
                changeFrequency: 'monthly',
                lastModified: pageDate('help', slug, locale),
            })
        }

        // Use cases
        for (const slug of listPublishedSlugs('use-cases')) {
            if (!hasPublishedPageContent('use-cases', slug, locale)) continue
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
            if (!hasPublishedPageContent('stories', slug, locale)) continue
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
            if (!hasPublishedPageContent('withdraw', slug, locale)) continue
            pages.push({
                path: `/${locale}/withdraw/${slug}`,
                priority: 0.6 * basePriority,
                changeFrequency: 'monthly',
                lastModified: pageDate('withdraw', slug, locale),
            })
        }

        // Supported networks
        if (hasPublishedSingletonContent('supported-networks', locale)) {
            pages.push({
                path: `/${locale}/supported-networks`,
                priority: 0.6 * basePriority,
                changeFrequency: 'monthly',
                lastModified: singletonDate('supported-networks', locale),
            })
        }

        // Pricing
        if (hasPublishedSingletonContent('pricing', locale)) {
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
        for (const topic of listContentTopics(locale)) {
            pages.push({
                path: `/${locale}/content/${topic}`,
                priority: 0.7 * basePriority,
                changeFrequency: 'weekly',
            })
        }
        for (const slug of listContentSlugs('blog')) {
            if (slug === 'index') continue
            if (!isPublished(readPageContent('blog', slug, locale))) continue
            pages.push({
                path: `/${locale}/blog/${slug}`,
                priority: 0.6 * basePriority,
                changeFrequency: 'monthly',
                lastModified: pageDate('blog', slug, locale),
            })
        }

        // Team pages excluded from production sitemap (not yet launched)
    }

    // Retired URLs may still have content files during the mirror's migration.
    // Only list terminal pages, not their old 410 or permanent-redirect URLs.
    return pages.filter((page) => !isGoneMarketingPath(page.path) && !isPermanentRedirectPath(page.path))
}
