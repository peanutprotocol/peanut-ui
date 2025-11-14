import type { MetadataRoute } from 'next'

// note: @dev incase you wanna change the icons,
// better approach is to rename the image files so that browsers dont serve the cached old ones
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
        display_override: ['standalone'],
        background_color: '#ffffff',
        theme_color: '#000000',
        icons: [
            {
                src: '/icons/icon-192x192-beta.png',
                sizes: '192x192',
                type: 'image/png',
                purpose: 'maskable',
            },
            {
                src: '/icons/icon-512x512-beta.png',
                sizes: '512x512',
                type: 'image/png',
                purpose: 'maskable',
            },
            {
                src: '/icons/icon-192x192-beta.png',
                sizes: '192x192',
                type: 'image/png',
                purpose: 'any',
            },
            {
                src: '/icons/icon-512x512-beta.png',
                sizes: '512x512',
                type: 'image/png',
                purpose: 'any',
            },
            {
                src: '/icons/apple-touch-icon-beta.png',
                sizes: '180x180',
                type: 'image/png',
            },
            {
                src: '/icons/apple-touch-icon-152x152-beta.png',
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
                url: `${process.env.NEXT_PUBLIC_BASE_URL}/manifest.webmanifest`,
            },
            {
                platform: 'ios',
                url: 'https://peanut.me',
            },
        ],
        scope: '/',
        orientation: 'portrait',
    }
}
