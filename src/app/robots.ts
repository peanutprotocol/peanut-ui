import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
    return {
        rules: [
            {
                userAgent: '*',
                allow: ['/', '/about', '/send', '/request/create', '/cashout', '/jobs'],
                disallow: ['/api/', '/sdk/', '/*dashboard', '/*profile'],
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
        sitemap: `${process.env.NEXT_PUBLIC_BASE_URL || 'https://peanut.me'}/sitemap.xml`,
    }
}
