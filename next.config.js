/** @type {import('next').NextConfig} */
const nextConfig = {
    env: {
        WC_PROJECT_ID: process.env.WC_PROJECT_ID,
        SOCKET_API_KEY: process.env.SOCKET_API_KEY,
        PEANUT_API_KEY: process.env.PEANUT_API_KEY,
        GA_KEY: process.env.GA_KEY,
        PROMO_LIST: process.env.PROMO_LIST,
        SENTRY_DSN: process.env.SENTRY_DSN,
        NOTIFY_API_SECRET: process.env.NOTIFY_API_SECRET,
        DISCORD_WEBHOOK_URL: process.env.DISCORD_WEBHOOK_URL,
    },
    async rewrites() {
        return [
            {
                source: '/apple-app-site-association',
                destination: '/api/apple-app-site-association',
            },
            {
                source: '/.well-known/assetLinks.json',
                destination: '/api/assetLinks',
            },
            {
                source: '/:path*',
                destination: 'https://peanut.to/create-packet',
                has: [
                    {
                        type: 'host',
                        value: 'red.peanut.to',
                    },
                ],
            },
        ]
    },
    async redirects() {
        return [
            {
                source: '/docs',
                destination: 'https://docs.peanut.to',
                permanent: false,
                basePath: false,
            },
        ]
    },
    async headers() {
        return [
            {
                source: '/apple-app-site-association',
                headers: [
                    {
                        key: 'Content-Type',
                        value: 'application/json',
                    },
                ],
            },
            {
                source: '/.well-known/assetlinks.json',
                headers: [
                    {
                        key: 'Content-Type',
                        value: 'application/json',
                    },
                ],
            },
            {
                source: '/(.*)',
                headers: [{ key: 'X-Frame-Options', value: 'DENY' }],
            },
        ]
    },
}

module.exports = nextConfig
