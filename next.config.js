/** @type {import('next').NextConfig} */
const nextConfig = {
    env: {
        WC_PROJECT_ID: process.env.WC_PROJECT_ID,
        SOCKET_API_KEY: process.env.SOCKET_API_KEY,
        PEANUT_API_KEY: process.env.PEANUT_API_KEY,
        GA_KEY: process.env.GA_KEY,
        PROMO_LIST: process.env.PROMO_LIST,
        SENTRY_DSN: process.env.SENTRY_DSN,
    },
    productionBrowserSourceMaps: true,
    swcMinify: true,
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
        ]
    },
}

module.exports = nextConfig
