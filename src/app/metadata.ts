import { BASE_URL } from '@/constants/general.consts'
import { type Metadata } from 'next'

export function generateMetadata({
    title,
    description,
    image = '/metadata-img.png',
    dynamicOg = false,
    ogSubtitle,
    keywords,
    canonical,
}: {
    title: string
    description: string
    image?: string
    /** Generate a branded OG image dynamically from the title */
    dynamicOg?: boolean
    /** Subtitle shown on dynamic OG image */
    ogSubtitle?: string
    keywords?: string
    /** Canonical URL path (e.g. '/careers') or full URL. Resolved against metadataBase. */
    canonical?: string
}): Metadata {
    const ogImage = dynamicOg
        ? `/api/og/marketing?title=${encodeURIComponent(title)}${ogSubtitle ? `&subtitle=${encodeURIComponent(ogSubtitle)}` : ''}`
        : image

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
            images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
        },
        twitter: {
            card: 'summary_large_image',
            title,
            description,
            images: [ogImage],
            creator: '@PeanutProtocol',
            site: '@PeanutProtocol',
        },
        applicationName: process.env.NODE_ENV === 'development' ? 'Peanut Dev' : 'Peanut',
        ...(canonical ? { alternates: { canonical } } : {}),
    }
}
