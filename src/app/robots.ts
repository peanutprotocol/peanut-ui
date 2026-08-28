import type { MetadataRoute } from 'next'
import { BASE_URL } from '@/constants/general.consts'
import { SUPPORTED_LOCALES } from '@/i18n/types'
import { GOOGLE_DEINDEX_CRAWL_ALLOW_PATHS, ROBOTS_DISALLOWED_PATHS } from '@/constants/seo-route-policy'

const IS_PRODUCTION_DOMAIN = BASE_URL === 'https://peanut.me'

// Paths kept out of the index: the API surface, the SDK bundle, and the
// auth-gated app routes. Used by the `*`, Googlebot, and AI-crawler groups;
// Twitterbot is the one deliberate exemption (see its comment). Mind the
// footgun when editing: a crawler only ever obeys the single most specific
// group that matches it, so a named group that omits a path silently opts
// that crawler out of it.
export default function robots(): MetadataRoute.Robots {
    // Block indexing on staging, preview deploys, and non-production domains
    if (!IS_PRODUCTION_DOMAIN) {
        return {
            rules: [{ userAgent: '*', disallow: ['/'] }],
        }
    }

    const disallowedPaths = [...ROBOTS_DISALLOWED_PATHS]

    return {
        rules: [
            // Twitterbot is DELIBERATELY unrestricted (empty disallow): it
            // fetches user-shared app URLs (claim links, payment requests,
            // receipts) to render link-preview cards on X, and it does not
            // index. Restricting it would break card unfurls on exactly the
            // links users share most.
            {
                userAgent: 'Twitterbot',
                allow: ['/api/og'],
                disallow: [],
            },

            // Googlebot must be able to fetch the dynamic OG images too — the
            // generic `disallow: /api/` below would otherwise block them. The
            // shared disallows are repeated here on purpose: Googlebot obeys
            // this group INSTEAD of the `*` group, so without them it would
            // treat every auth-gated route as crawlable. The narrower
            // `/api/og` allow still wins over `/api/` by longest-match.
            {
                userAgent: 'Googlebot',
                allow: ['/api/og', ...GOOGLE_DEINDEX_CRAWL_ALLOW_PATHS],
                disallow: disallowedPaths,
            },

            // AI search engine crawlers — explicitly welcome on all marketing
            // and content pages, blocked from the same app/transactional
            // surface as everyone else (they have no business in claim links,
            // receipts, or KYC — and their answers should cite content pages).
            {
                userAgent: [
                    'GPTBot',
                    'ChatGPT-User',
                    'PerplexityBot',
                    'ClaudeBot',
                    'Google-Extended',
                    'Applebot-Extended',
                ],
                allow: ['/'],
                disallow: disallowedPaths,
            },

            // Default rules for all crawlers
            {
                userAgent: '*',
                allow: [
                    '/',
                    '/careers',
                    '/privacy',
                    '/terms',
                    // Exact app shells currently present in search indexes.
                    // Narrow crawling lets engines process and refresh noindex.
                    ...GOOGLE_DEINDEX_CRAWL_ALLOW_PATHS,
                    // SEO routes (all locale-prefixed)
                    ...SUPPORTED_LOCALES.map((l) => `/${l}/`),
                ],
                disallow: disallowedPaths,
            },

            // A named group does not inherit `*`, so repeat the shared blocks.
            { userAgent: 'AhrefsBot', disallow: disallowedPaths, crawlDelay: 10 },
            { userAgent: 'SemrushBot', disallow: disallowedPaths, crawlDelay: 10 },
            { userAgent: 'MJ12bot', disallow: disallowedPaths, crawlDelay: 10 },
        ],
        sitemap: `${BASE_URL}/sitemap.xml`,
    }
}
