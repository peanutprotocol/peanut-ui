import { type MetadataRoute } from 'next'
import { BASE_URL } from '@/constants/general.consts'
import { COUNTRIES_SEO, CORRIDORS, CONVERT_PAIRS, COMPETITORS, EXCHANGES, PAYMENT_METHOD_SLUGS } from '@/data/seo'
import { getAllPosts } from '@/lib/blog'
import { SUPPORTED_LOCALES } from '@/i18n/config'
import type { Locale } from '@/i18n/types'

// TODO (infra): Set up 301 redirect peanut.to/* → peanut.me/ at Vercel/Cloudflare level
// TODO (infra): Set up 301 redirect docs.peanut.to/* → peanut.me/help
// TODO (infra): Update GitHub org, Twitter bio, LinkedIn, npm package.json → peanut.me
// TODO (infra): Add peanut.me to Google Search Console and submit this sitemap
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

        // Product pages
        { path: '/lp/card', priority: 0.9, changeFrequency: 'weekly' },

        // Public pages
        { path: '/careers', priority: 0.7, changeFrequency: 'monthly' },
        { path: '/exchange', priority: 0.7, changeFrequency: 'weekly' },

        // Legal
        { path: '/privacy', priority: 0.5, changeFrequency: 'yearly' },
        { path: '/terms', priority: 0.5, changeFrequency: 'yearly' },
    ]

    // --- Programmatic SEO pages (all locales with /{locale}/ prefix) ---
    for (const locale of SUPPORTED_LOCALES) {
        const isDefault = locale === 'en'
        const basePriority = isDefault ? 1.0 : 0.9 // EN gets slightly higher priority

        // Country hub pages
        for (const country of Object.keys(COUNTRIES_SEO)) {
            pages.push({ path: `/${locale}/${country}`, priority: 0.9 * basePriority, changeFrequency: 'weekly' })
        }

        // Corridor index + country pages
        pages.push({ path: `/${locale}/send-money-to`, priority: 0.9 * basePriority, changeFrequency: 'weekly' })
        for (const country of Object.keys(COUNTRIES_SEO)) {
            pages.push({
                path: `/${locale}/send-money-to/${country}`,
                priority: 0.8 * basePriority,
                changeFrequency: 'weekly',
            })
        }

        // From-to corridor pages
        for (const corridor of CORRIDORS) {
            pages.push({
                path: `/${locale}/send-money-from/${corridor.from}/to/${corridor.to}`,
                priority: 0.85 * basePriority,
                changeFrequency: 'weekly',
            })
        }

        // Receive money pages (unique sending countries from corridors)
        const receiveSources = [...new Set(CORRIDORS.map((c) => c.from))]
        for (const source of receiveSources) {
            pages.push({
                path: `/${locale}/receive-money-from/${source}`,
                priority: 0.7 * basePriority,
                changeFrequency: 'weekly',
            })
        }

        // Convert pages
        for (const pair of CONVERT_PAIRS) {
            pages.push({ path: `/${locale}/convert/${pair}`, priority: 0.7 * basePriority, changeFrequency: 'daily' })
        }

        // Comparison pages
        for (const slug of Object.keys(COMPETITORS)) {
            pages.push({
                path: `/${locale}/compare/peanut-vs-${slug}`,
                priority: 0.7 * basePriority,
                changeFrequency: 'monthly',
            })
        }

        // Deposit pages
        for (const exchange of Object.keys(EXCHANGES)) {
            pages.push({
                path: `/${locale}/deposit/from-${exchange}`,
                priority: 0.7 * basePriority,
                changeFrequency: 'monthly',
            })
        }

        // Pay-with pages
        for (const method of PAYMENT_METHOD_SLUGS) {
            pages.push({
                path: `/${locale}/pay-with/${method}`,
                priority: 0.7 * basePriority,
                changeFrequency: 'monthly',
            })
        }

        // Blog — only include posts that actually exist for this locale (avoid duplicate content)
        const localePosts = getAllPosts(locale as Locale)
        const enPosts = getAllPosts('en')
        const postsToInclude = localePosts.length > 0 ? localePosts : isDefault ? enPosts : []

        pages.push({ path: `/${locale}/blog`, priority: 0.8 * basePriority, changeFrequency: 'weekly' })
        for (const post of postsToInclude) {
            pages.push({
                path: `/${locale}/blog/${post.slug}`,
                priority: 0.6 * basePriority,
                changeFrequency: 'monthly',
                lastModified: new Date(post.frontmatter.date),
            })
        }

        // Team page
        pages.push({ path: `/${locale}/team`, priority: 0.5 * basePriority, changeFrequency: 'monthly' })
    }

    return pages.map((page) => ({
        url: `${BASE_URL}${page.path}`,
        lastModified: page.lastModified ?? BUILD_DATE,
        changeFrequency: page.changeFrequency,
        priority: page.priority,
    }))
}

export default generateSitemap
