import type { MetadataRoute } from 'next'
import { BASE_URL } from '@/constants/general.consts'
import { SUPPORTED_LOCALES } from '@/i18n/types'

const IS_PRODUCTION_DOMAIN = BASE_URL === 'https://peanut.me'

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
                disallow: [
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
                    '/invite',
                    '/kyc',
                    '/maintenance',
                    '/quests',
                    '/receipt',
                    '/crisp-proxy',
                    '/card-payment',
                    '/add-money',
                    '/withdraw',
                ],
            },

            // Rate-limit aggressive SEO crawlers
            { userAgent: 'AhrefsBot', crawlDelay: 10 },
            { userAgent: 'SemrushBot', crawlDelay: 10 },
            { userAgent: 'MJ12bot', crawlDelay: 10 },
        ],
        sitemap: `${BASE_URL}/sitemap.xml`,
    }
}
