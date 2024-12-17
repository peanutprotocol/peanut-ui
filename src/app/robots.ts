import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
    return {
        rules: [
            {
                userAgent: '*',
                allow: ['/', '/about', '/blog', '/terms', '/privacy', '/send', '/request/create', '/cashout', '/jobs'],
                disallow: [
                    '/api/',
                    '/sdk',
                    '/dashboard',
                    '/profile',
                    '/kyc',
                    '/link-account',
                    '/cashout',
                    '/cashout-status',
                ],
            },
            {
                userAgent: 'AhrefsBot',
                crawlDelay: 10,
            },
            {
                userAgent: 'SemrushBot',
                crawlDelay: 10,
            },
        ],
        sitemap: 'https://peanut.to/sitemap.xml',
    }
}
