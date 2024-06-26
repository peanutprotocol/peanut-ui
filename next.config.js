/** @type {import('next').NextConfig} */
const nextConfig = {
    images: {
        remotePatterns: [
            {
                hostname: '*',
                protocol: 'http',
            },
            {
                hostname: '*',
                protocol: 'https',
            },
        ],
    },
    reactStrictMode: false,
    async rewrites() {
        return {
            beforeFiles: [
                {
                    source: '/apple-app-site-association',
                    destination: '/api/apple-app-site-association',
                },
                {
                    source: '/.well-known/assetLinks.json',
                    destination: '/api/assetLinks',
                },
            ],
        }
    },
    async redirects() {
        return [
            {
                source: '/docs',
                destination: 'https://docs.peanut.to',
                permanent: false,
                basePath: false,
            },
            {
                source: '/packet',
                destination: '/raffle/claim',
                permanent: true,
            },
            {
                source: '/create-packet',
                destination: '/raffle/create',
                permanent: true,
            },
            {
                source: '/batch/create',
                destination: 'https://legacy.peanut.to/batch/create',
                permanent: true,
            },
            {
                source: '/raffle/create',
                destination: 'https://legacy.peanut.to/raffle/create',
                permanent: true,
            },
            {
                source: '/raffle/claim',
                destination: 'https://legacy.peanut.to/raffle/claim',
                permanent: true,
            },
            {
                source: '/',
                destination: '/send',
                permanent: true,
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
                source: '/manifest.json',
                headers: [
                    { key: 'Access-Control-Allow-Origin', value: '*' },
                    { key: 'Access-Control-Allow-Methods', value: 'GET' },
                    { key: 'Access-Control-Allow-Headers', value: 'X-Requested-With, content-type, Authorization' },
                ],
            },

            {
                source: '/:path*',
                headers: [
                    {
                        key: 'Permissions-Policy',
                        value: 'clipboard-read=(self), clipboard-write=(self)',
                    },
                ],
            },
        ]
    },
}

module.exports = nextConfig

const { withSentryConfig } = require('@sentry/nextjs')

module.exports = withSentryConfig(
    module.exports,
    {
        // For all available options, see:
        // https://github.com/getsentry/sentry-webpack-plugin#options

        // Suppresses source map uploading logs during build
        silent: true,
        org: 'peanut-c34d84c05',
        project: 'peanut-ui',
    },
    {
        // For all available options, see:
        // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

        // Upload a larger set of source maps for prettier stack traces (increases build time)
        widenClientFileUpload: true,

        // Transpiles SDK to be compatible with IE11 (increases bundle size)
        transpileClientSDK: true,

        // Routes browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers. (increases server load)
        // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
        // side errors will fail.
        tunnelRoute: '/monitoring',

        // Hides source maps from generated client bundles
        hideSourceMaps: true,

        // Automatically tree-shake Sentry logger statements to reduce bundle size
        disableLogger: true,

        // Enables automatic instrumentation of Vercel Cron Monitors.
        // See the following for more information:
        // https://docs.sentry.io/product/crons/
        // https://vercel.com/docs/cron-jobs
        automaticVercelMonitors: true,
    }
)
