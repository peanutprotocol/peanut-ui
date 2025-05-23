import { Metadata } from 'next'

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
        metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || 'https://peanut.to'),
        icons: { icon: '/favicon.ico' },
        keywords,
        openGraph: {
            type: 'website',
            title,
            description,
            url: 'https://peanut.to',
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
    }
}
