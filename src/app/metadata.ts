import { Metadata } from 'next'
import { BASE_URL } from '@/constants'

export function generateMetadata({
    title,
    description,
    image = '/metadata-img.png',
    keywords,
}: {
    title: string
    description: string
    image?: string
    keywords?: string
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
            url: BASE_URL,
            siteName: 'Peanut Protocol',
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
    }
}
