import { MetadataRoute } from 'next'

async function generateSitemap(): Promise<MetadataRoute.Sitemap> {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://peanut.me'

    const staticPages = ['', '/about', '/jobs']

    // generate entries for static pages
    const staticEntries = staticPages.map((page) => ({
        url: `${baseUrl}${page}`,
        lastModified: new Date(),
        changeFrequency: 'weekly' as const,
        priority: 1.0,
    }))

    return staticEntries
}

export default generateSitemap
