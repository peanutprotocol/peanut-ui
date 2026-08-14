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
    hasCorridorContent,
    hasPageContent,
    hasSingletonContent,
    listContentSlugs,
    listPublishedSlugs,
} from '@/lib/content'

// TODO (infra): Update GitHub org, Twitter bio, LinkedIn, npm package.json → peanut.me
// TODO (GA4): Create data filter to exclude trafficheap.com referral traffic

/** Build date used for non-content pages that don't have their own date. */
const BUILD_DATE = new Date()

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
        { path: '/exchange', priority: 0.7, changeFrequency: 'weekly' },
        // The only card landing URL left — /lp/card is a 308 to it, so the
        // target has to be listed.
        { path: '/shhhhh', priority: 0.7, changeFrequency: 'weekly' },

        // Legal — the bare /privacy and /terms are redirects; list the real URLs.
        { path: '/en/privacy', priority: 0.5, changeFrequency: 'yearly' },
        { path: '/en/terms', priority: 0.5, changeFrequency: 'yearly' },
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
            pages.push({ path: `/${locale}/${country}`, priority: 0.9 * basePriority, changeFrequency: 'weekly' })
        }

        // Send-money-to country pages
        for (const country of Object.keys(COUNTRIES_SEO)) {
            if (!hasPageContent('send-to', country, locale)) continue
            pages.push({
                path: `/${locale}/send-money-to/${country}`,
                priority: 0.8 * basePriority,
                changeFrequency: 'weekly',
            })
        }

        // From-to corridor pages
        for (const corridor of CORRIDORS) {
            if (!hasCorridorContent(corridor.to, corridor.from, locale)) continue
            pages.push({
                path: `/${locale}/send-money-from/${corridor.from}/to/${corridor.to}`,
                priority: 0.85 * basePriority,
                changeFrequency: 'weekly',
            })
        }

        // Receive money pages — corridor origins that have a receive-from article
        for (const source of RECEIVE_SOURCES) {
            if (!hasPageContent('receive-from', source, locale)) continue
            pages.push({
                path: `/${locale}/receive-money-from/${source}`,
                priority: 0.7 * basePriority,
                changeFrequency: 'weekly',
            })
        }

        // Comparison pages
        for (const slug of Object.keys(COMPETITORS)) {
            if (!hasPageContent('compare', slug, locale)) continue
            pages.push({
                path: `/${locale}/compare/peanut-vs-${slug}`,
                priority: 0.7 * basePriority,
                changeFrequency: 'monthly',
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
            })
        }
        for (const rail of Object.keys(DEPOSIT_RAILS)) {
            if (!hasPageContent('deposit', rail, locale)) continue
            pages.push({
                path: `/${locale}/deposit/via-${rail}`,
                priority: 0.7 * basePriority,
                changeFrequency: 'monthly',
            })
        }

        // Pay-with pages
        for (const method of PAYMENT_METHOD_SLUGS) {
            if (!hasPageContent('pay-with', method, locale)) continue
            pages.push({
                path: `/${locale}/pay-with/${method}`,
                priority: 0.7 * basePriority,
                changeFrequency: 'monthly',
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
            })
        }

        // Use cases
        for (const slug of listPublishedSlugs('use-cases')) {
            if (!hasPageContent('use-cases', slug, locale)) continue
            pages.push({
                path: `/${locale}/use-cases/${slug}`,
                priority: 0.7 * basePriority,
                changeFrequency: 'monthly',
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
            })
        }

        // Supported networks
        if (hasSingletonContent('supported-networks', locale)) {
            pages.push({
                path: `/${locale}/supported-networks`,
                priority: 0.6 * basePriority,
                changeFrequency: 'monthly',
            })
        }

        // Pricing
        if (hasSingletonContent('pricing', locale)) {
            pages.push({
                path: `/${locale}/pricing`,
                priority: 0.7 * basePriority,
                changeFrequency: 'monthly',
            })
        }

        // Content hub + blog
        pages.push({
            path: `/${locale}/content`,
            priority: 0.7 * basePriority,
            changeFrequency: 'weekly',
        })
        pages.push({
            path: `/${locale}/blog`,
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
