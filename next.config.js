const { withSentryConfig } = require('@sentry/nextjs')
const { PHASE_DEVELOPMENT_SERVER, PHASE_PRODUCTION_BUILD } = require('next/constants')

/** @type {import('next').NextConfig} */

const os = require('os')

function getLocalIpAddress() {
    const interfaces = os.networkInterfaces()
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address
            }
        }
    }
    return null
}
if (process.env.NODE_ENV !== 'production') {
    console.log(`Connect to local app @ IP: https://${getLocalIpAddress()}`)
}

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
                source: '/pioneers',
                destination: '/',
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

module.exports = async (phase) => {
    let conf = nextConfig
    if (phase === PHASE_DEVELOPMENT_SERVER || phase === PHASE_PRODUCTION_BUILD) {
        console.log('withSerwist')
        const withSerwist = (await import('@serwist/next')).default({
            swSrc: 'src/app/sw.ts',
            swDest: 'public/sw.js',
        })

        conf = withSerwist(conf)
    }

    if (process.env.NODE_ENV !== 'development') {
        console.log('withSentryConfig')
        cong = withSentryConfig(conf, {
            // For all available options, see:
            // https://github.com/getsentry/sentry-webpack-plugin#options

            org: 'peanut-c34d84c05',
            project: 'peanut-ui',

            // Only print logs for uploading source maps in CI

            // For all available options, see:
            // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

            // Upload a larger set of source maps for prettier stack traces (increases build time)
            widenClientFileUpload: true,

            // Automatically annotate React components to show their full name in breadcrumbs and session replay
            reactComponentAnnotation: {
                enabled: true,
            },

            // Uncomment to route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
            // This can increase your server load as well as your hosting bill.
            // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
            // side errors will fail.
            tunnelRoute: '/monitoring',

            // Hides source maps from generated client bundles
            hideSourceMaps: true,

            // Automatically tree-shake Sentry logger statements to reduce bundle size
            disableLogger: true,

            // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
            // See the following for more information:
            // https://docs.sentry.io/product/crons/
            // https://vercel.com/docs/cron-jobs
            automaticVercelMonitors: true,
        })
    }

    return conf
}
