import type { MetadataRoute } from 'next'
import { BASE_URL } from '@/constants/general.consts'
import { SUPPORTED_LOCALES } from '@/i18n/types'

const IS_PRODUCTION_DOMAIN = BASE_URL === 'https://peanut.me'

// Paths kept out of the index: the API surface, the SDK bundle, and the
// auth-gated app routes. Shared by every named crawler group — a group that
// omits these silently opts that crawler out of ALL disallows, because a
// user-agent only ever obeys the single most specific group that matches it.
const DISALLOWED_PATHS = [
    '/api/',
    '/sdk/',
    // Auth-gated app routes
    '/home',
    '/profile',
    '/settings',
    '/send',
    '/request',
    '/setup',
    '/claim',
    '/pay',
    '/dev/',
    '/qr',
    '/history',
    '/points',
    '/rewards',
    '/invite',
    '/kyc',
    '/maintenance',
    '/quests',
    '/receipt',
    '/crisp-proxy',
    '/card-payment',
    '/add-money',
    '/withdraw',
]

export default function robots(): MetadataRoute.Robots {
    // Block indexing on staging, preview deploys, and non-production domains
    if (!IS_PRODUCTION_DOMAIN) {
        return {
            rules: [{ userAgent: '*', disallow: ['/'] }],
        }
    }

    return {
        rules: [
            // Allow Twitterbot to fetch OG images for link previews
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
                allow: ['/api/og'],
                disallow: DISALLOWED_PATHS,
            },

            // AI search engine crawlers — explicitly welcome
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
                disallow: ['/api/', '/home', '/profile', '/settings', '/setup', '/dev/'],
            },

            // Default rules for all crawlers
            {
                userAgent: '*',
                allow: [
                    '/',
                    '/careers',
                    '/privacy',
                    '/terms',
                    '/exchange',
                    '/lp/card',
                    // SEO routes (all locale-prefixed)
                    ...SUPPORTED_LOCALES.map((l) => `/${l}/`),
                ],
                disallow: DISALLOWED_PATHS,
            },

            // Rate-limit aggressive SEO crawlers
            { userAgent: 'AhrefsBot', crawlDelay: 10 },
            { userAgent: 'SemrushBot', crawlDelay: 10 },
            { userAgent: 'MJ12bot', crawlDelay: 10 },
        ],
        sitemap: `${BASE_URL}/sitemap.xml`,
    }
}
