const os = require('os')
const { execSync } = require('child_process')
const withBundleAnalyzer = require('@next/bundle-analyzer')({
    // Only enable in production builds when explicitly requested
    enabled: process.env.ANALYZE === 'true' && process.env.NODE_ENV !== 'development',
})

const redirectsConfig = require('./redirects.json')

// Get git commit hash at build time
let gitCommitHash = 'unknown'
try {
    gitCommitHash = execSync('git rev-parse --short=7 HEAD').toString().trim()
} catch (error) {
    console.warn('Could not get git commit hash:', error.message)
}
const interfaces = os.networkInterfaces()
let ipAddress = 'Unable to determine IP address'

try {
    // Loop through all network interfaces
    Object.keys(interfaces).forEach((ifname) => {
        interfaces[ifname].forEach((iface) => {
            // Skip internal, non-IPv4 addresses, and APIPA addresses
            if (iface.family === 'IPv4') {
                ipAddress = iface.address
            }
        })
    })
    console.log(`Your IP address is: ${ipAddress}`)
} catch (error) {
    console.error('Error getting IP address:', error)
}

/** @type {import('next').NextConfig} */
let nextConfig = {
    env: {
        NEXT_PUBLIC_GIT_COMMIT_HASH: gitCommitHash,
    },
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

    // Turbopack configuration for faster dev builds
    turbopack: {
        resolveAlias: {
            // Optimize common aliases
            '@': './src',
        },
    },

    // Disable source maps in production (already handled by Sentry)
    productionBrowserSourceMaps: false,

    // Transpile packages for better compatibility
    transpilePackages: ['@squirrel-labs/peanut-sdk'],

    // Experimental features for optimization
    experimental: {
        // Note: turbopackFileSystemCacheForDev is enabled by default in Next.js 16+
        // optimize package imports for tree-shaking (barrel file optimization)
        // lodash and date-fns are used by transitive dependencies (e.g. chakra, framer-motion)
        optimizePackageImports: [
            '@chakra-ui/react',
            'framer-motion',
            '@headlessui/react',
            '@radix-ui/react-accordion',
            '@radix-ui/react-select',
            '@radix-ui/react-slider',
            '@reduxjs/toolkit',
            'react-redux',
            'lodash',
            'date-fns',
            'react-hook-form',
        ],
        // Speed up webpack builds (used for production builds with --webpack flag)
        webpackBuildWorker: true,
    },

    webpack: (config, { isServer, dev }) => {
        if (!dev || !process.env.NEXT_TURBO) {
            if (isServer) {
                config.ignoreWarnings = [{ module: /@opentelemetry\/instrumentation/, message: /Critical dependency/ }]
            }
        }

        return config
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
                    source: '/.well-known/apple-app-site-association',
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
        return process.env.NODE_ENV === 'development' ? [] : redirectsConfig
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
                        value: 'camera=(self "*"), microphone=(self "*"), clipboard-read=(self), clipboard-write=(self)',
                    },
                ],
            },
        ]
    },
}

if (process.env.NODE_ENV !== 'development' && !Boolean(process.env.LOCAL_BUILD)) {
    const { withSentryConfig } = require('@sentry/nextjs')

    const telemetry = process.env.LOCAL_BUILD ? false : true

    nextConfig = withSentryConfig(nextConfig, {
        telemetry,
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
        sourcemaps: {
            deleteSourcemapsAfterUpload: true,
        },
    })
} else {
    module.exports = nextConfig
}

if (process.env.NODE_ENV !== 'development') {
    module.exports = async () => {
        const withSerwist = (await import('@serwist/next')).default({
            swSrc: './src/app/sw.ts',
            swDest: 'public/sw.js',
            // explicitly include offline screen assets in precache
            additionalPrecacheEntries: ['/icons/peanut-icon.svg'],
        })
        return withSerwist(nextConfig)
    }
}

module.exports = withBundleAnalyzer(nextConfig)
