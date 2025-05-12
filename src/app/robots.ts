import type { MetadataRoute } from 'next'
import { BASE_URL } from '@/constants'

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
        sitemap: `${BASE_URL}/sitemap.xml`,
    }
}
