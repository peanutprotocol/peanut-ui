const os = require('os')
const { execSync } = require('child_process')
const withBundleAnalyzer =
    process.env.ANALYZE === 'true' ? require('@next/bundle-analyzer')({ enabled: true }) : (config) => config

const redirectsConfig = require('./redirects.json')

/**
 * Sentry's CSP-report ingest endpoint, derived from the browser DSN
 * (`https://<publicKey>@<host>/<projectId>`). Returns null when the DSN is
 * absent or malformed, in which case the policy still ships — it just has
 * nowhere to report, which is better than emitting a broken `report-uri`.
 */
function sentryCspReportUri() {
    const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN
    if (!dsn) return null
    try {
        const { host, username, pathname } = new URL(dsn)
        const projectId = pathname.replace(/^\//, '')
        if (!host || !username || !projectId) return null
        return `https://${host}/api/${projectId}/security/?sentry_key=${username}`
    } catch {
        return null
    }
}

/**
 * First-draft CSP, shipped REPORT-ONLY.
 *
 * Nothing here is enforced yet: the app currently has no script-src at all, so
 * an XSS anywhere is unconstrained. Guessing the allow-list and enforcing it
 * would blank the app; instead this collects violation reports from real
 * traffic until the list is known to be complete, then it gets promoted to the
 * enforcing `Content-Security-Policy` header.
 *
 * Known-loose parts, to tighten before promotion:
 * - `'unsafe-inline'` / `'unsafe-eval'` in script-src: Next's inline bootstrap
 *   and the wallet SDKs need them today. Moving to nonces is its own change.
 * - connect-src can't enumerate every chain RPC (they come from env and vary by
 *   network), so the report stream is what completes this list.
 */
function contentSecurityPolicyReportOnly() {
    const reportUri = sentryCspReportUri()
    const directives = [
        "default-src 'self'",
        // PostHog is same-origin via the /relay rewrite, so it needs no entry here.
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://client.crisp.chat https://static.sumsub.com",
        "style-src 'self' 'unsafe-inline' https://client.crisp.chat",
        "img-src 'self' data: blob: https:",
        "font-src 'self' data: https://client.crisp.chat",
        [
            "connect-src 'self'",
            'https://api.peanut.me',
            'https://*.peanut.me',
            'https://*.ingest.sentry.io',
            'https://*.ingest.us.sentry.io',
            'https://www.google-analytics.com',
            'https://rpc.zerodev.app',
            'https://*.g.alchemy.com',
            'https://rpc.ankr.com',
            'https://assets.coingecko.com',
            'https://coin-images.coingecko.com',
            'https://api.frankfurter.app',
            'https://dolarapi.com',
            'https://client.crisp.chat',
            'wss://client.relay.crisp.chat',
            'https://*.sumsub.com',
            'https://widget.manteca.dev',
        ].join(' '),
        "frame-src 'self' https://client.crisp.chat https://*.sumsub.com https://widget.manteca.dev https://mpago.la",
        "worker-src 'self' blob:",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
    ]
    if (reportUri) directives.push(`report-uri ${reportUri}`)
    return directives.join('; ')
}

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
        // Vercel injects VERCEL_ENV and VERCEL_GIT_COMMIT_REF server-side at
        // build time. Re-export as NEXT_PUBLIC_* so the client bundle (and
        // src/utils/sentry-env.ts in particular) can read them too.
        NEXT_PUBLIC_VERCEL_ENV: process.env.VERCEL_ENV,
        NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF: process.env.VERCEL_GIT_COMMIT_REF,
    },

    // Next.js 16 blocks cross-origin dev requests (HMR, chunk loads) unless
    // explicitly allowed. Comma-separated list via env so contributors can add
    // their own tunnel/ngrok hostnames without touching this file.
    allowedDevOrigins: (process.env.NEXT_ALLOWED_DEV_ORIGINS ?? 'peanut.mucu.dev')
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean),
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
            '@mui/icons-material',
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
    skipTrailingSlashRedirect: true,
    async rewrites() {
        return {
            // Domain-association files (apple-app-site-association, assetlinks.json)
            // are served statically from public/.well-known/ — no rewrites here,
            // or they would shadow the static files.
            beforeFiles: [],
            afterFiles: [
                // PostHog reverse proxy — bypasses ad blockers. Path renamed
                // from /ingest/ (which uBlock Origin's default lists block as
                // a known PostHog signature, causing retry storms in the
                // console). Keep this name innocuous; rotate again if it
                // gets added to the lists.
                {
                    source: '/relay/static/:path*',
                    destination: 'https://eu-assets.i.posthog.com/static/:path*',
                },
                {
                    source: '/relay/:path*',
                    destination: 'https://eu.i.posthog.com/:path*',
                },
                // Same-origin passkey path. The backend's /passkeys/{login,register}/verify
                // returns Set-Cookie: jwt-token=… without a Domain attribute, so the cookie
                // lands on whatever origin served the response. Direct calls to api.peanut.me
                // would put the cookie on the wrong subdomain and break web login. This
                // edge-level rewrite (no Vercel function, no fetch wrapping) keeps the
                // request same-origin so Set-Cookie lands on peanut.me. Native bypasses
                // this entirely — static export ignores rewrites and uses the direct
                // URL + body-token pattern (see PASSKEY_SERVER_URL in zerodev.consts.ts).
                {
                    source: '/passkeys/:path*',
                    destination: `${process.env.NEXT_PUBLIC_PEANUT_API_URL || 'https://api.peanut.me'}/passkeys/:path*`,
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
                source: '/.well-known/apple-app-site-association',
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
                        value: 'camera=*, microphone=*, clipboard-read=(self), clipboard-write=(self)',
                    },
                    // Security headers - prevents clickjacking and other attacks
                    // Using frame-ancestors instead of X-Frame-Options to allow specific domains
                    // object-src/base-uri are safe to enforce today: the app embeds no
                    // plugins and sets no <base>, so neither can break a working page.
                    {
                        key: 'Content-Security-Policy',
                        value: "frame-ancestors 'self' https://hugo0.com; object-src 'none'; base-uri 'self'",
                    },
                    { key: 'Content-Security-Policy-Report-Only', value: contentSecurityPolicyReportOnly() },
                    { key: 'X-Content-Type-Options', value: 'nosniff' },
                    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
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
}

if (process.env.NODE_ENV !== 'development') {
    module.exports = async () => {
        const withSerwist = (await import('@serwist/next')).default({
            swSrc: './src/app/sw.ts',
            swDest: 'public/sw.js',
            // explicitly include offline screen assets in precache
            additionalPrecacheEntries: ['/icons/peanut-icon.svg'],
        })
        return withBundleAnalyzer(withSerwist(nextConfig))
    }
} else {
    module.exports = nextConfig
}
