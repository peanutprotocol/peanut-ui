import type { MetadataRoute } from 'next'

// extend manifest type to support pwa deep linking capabilities
interface ExtendedManifest extends MetadataRoute.Manifest {
    capture_links?: 'existing-client-navigate'
    handle_links?: 'preferred'
}

export default function manifest(): ExtendedManifest {
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
        scope: '/',
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
                url: '/home',
            },
        ],
        related_applications: [
            {
                platform: 'webapp',
                url: 'https://peanut.me/manifest.json',
            },
            {
                platform: 'ios',
                url: 'https://peanut.me',
            },
        ],
    }
}
