import type { MetadataRoute } from 'next'

const getBaseUrl = () => {
    if (process.env.VERCEL_ENV === 'preview') {
        return `https://${process.env.VERCEL_BRANCH_URL}`
    }
    return process.env.NEXT_PUBLIC_BASE_URL || 'https://peanut.me'
}

export default function manifest(): MetadataRoute.Manifest {
    let name = 'Peanut'
    switch (process.env.NODE_ENV) {
        case 'development':
            name = 'Peanut Dev'
            break
        case 'test':
            name = 'Peanut Test'
            break
    }
    return {
        name,
        short_name: name,
        description: 'Butter smooth global money',
        start_url: '/home',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#000000',
        icons: [
            {
                src: '/icons/icon-192x192.png',
                sizes: '192x192',
                type: 'image/png',
                purpose: 'maskable',
            },
            {
                src: '/icons/icon-512x512.png',
                sizes: '512x512',
                type: 'image/png',
                purpose: 'maskable',
            },
            {
                src: '/icons/apple-touch-icon.png',
                sizes: '180x180',
                type: 'image/png',
            },
            {
                src: '/icons/apple-touch-icon-152x152.png',
                sizes: '152x152',
                type: 'image/png',
            },
        ],
        protocol_handlers: [
            {
                protocol: 'web+peanut',
                url: `${getBaseUrl()}/home`,
            },
        ],
        related_applications: [
            {
                platform: 'webapp',
                url: `${getBaseUrl()}/manifest.webmanifest`,
            },
            {
                platform: 'ios',
                url: getBaseUrl(),
            },
        ],
        scope: '/',
    }
}
