import { BASE_URL } from '@/constants/general.consts'
import { type Metadata } from 'next'

export function generateMetadata({
    title,
    description,
    image = '/metadata-img.png',
    keywords,
    canonical,
}: {
    title: string
    description: string
    image?: string
    keywords?: string
    /** Canonical URL path (e.g. '/careers') or full URL. Resolved against metadataBase. */
    canonical?: string
}): Metadata {
    return {
        title,
        description,
        metadataBase: new URL(BASE_URL),
        icons: { icon: '/favicon.ico' },
        keywords,
        openGraph: {
            type: 'website',
            title,
            description,
            url: canonical ? `${BASE_URL}${canonical}` : BASE_URL,
            siteName: 'Peanut',
            images: [{ url: image, width: 1200, height: 630, alt: title }],
        },
        twitter: {
            card: 'summary_large_image',
            title,
            description,
            images: [image],
            creator: '@PeanutProtocol',
            site: '@PeanutProtocol',
        },
        applicationName: process.env.NODE_ENV === 'development' ? 'Peanut Dev' : 'Peanut',
        ...(canonical ? { alternates: { canonical } } : {}),
    }
}
