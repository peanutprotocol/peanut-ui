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
        metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || 'https://peanut.me'),
        icons: { icon: '/favicon.ico' },
        keywords,
        openGraph: {
            type: 'website',
            title,
            description,
            url: 'https://peanut.me',
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
        other: {
            'apple-mobile-web-app-capable': 'yes',
            'mobile-web-app-capable': 'yes',
            'apple-mobile-web-app-status-bar-style': 'default',
            'apple-mobile-web-app-title': 'Peanut',
            'application-name': 'Peanut',
        },
        applicationName: 'Peanut',
        appleWebApp: {
            capable: true,
            title: 'Peanut',
            statusBarStyle: 'black-translucent',
            startupImage: ['/icons/apple-touch-icon.png'],
        },
    }
}
