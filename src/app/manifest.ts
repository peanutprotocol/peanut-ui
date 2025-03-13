import type { MetadataRoute } from 'next'

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
            },
        ],
        protocol_handlers: [
            {
                protocol: 'web+peanut',
                url: '/home',
            },
        ],
        related_applications: [
            {
                platform: 'webapp',
                url: 'https://peanut.me/manifest.json',
            },
        ],
        scope: '/',
    }
}
