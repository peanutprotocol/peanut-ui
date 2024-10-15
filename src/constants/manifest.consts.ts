import { MetadataRoute } from 'next'

export const manifest: MetadataRoute.Manifest = {
    name: 'Peanut Protocol',
    short_name: 'Peanut',
    description: 'Buttery smooth global money',
    icons: [
        {
            src: '/pwa/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
        },
        {
            src: '/pwa/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
        },
        {
            src: 'logo-favicon.png',
            sizes: 'any',
            type: 'image/png',
        },
    ],
    theme_color: '#FFFFFF',
    background_color: '#FFFFFF',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
}
