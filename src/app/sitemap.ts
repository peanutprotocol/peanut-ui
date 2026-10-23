import { type MetadataRoute } from 'next'
import { BASE_URL } from '@/constants/general.consts'
import { getIndexablePages } from '@/lib/seo/url-inventory'

export default async function generateSitemap(): Promise<MetadataRoute.Sitemap> {
    return getIndexablePages().map(({ path, ...metadata }) => ({
        url: `${BASE_URL}${path === '/' ? '' : path}`,
        ...metadata,
    }))
}
