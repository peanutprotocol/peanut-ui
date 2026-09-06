const path = require('path')
const os = require('os')
const { execSync } = require('child_process')
const withBundleAnalyzer =
    process.env.ANALYZE === 'true' ? require('@next/bundle-analyzer')({ enabled: true }) : (config) => config

const redirectsConfig = require('./redirects.json')
const { buildNoindexHeaderRules } = require('./src/constants/seo-route-policy')
const { googleAdsRemarketingHosts } = require('./csp-google-domains')

/**
 * Same-origin collector for violation reports (src/app/api/csp-report). It
 * derives Sentry's ingest URL from the DSN and forwards there, dropping the
 * noise Sentry would otherwise group into issues nobody can act on.
 *
 * Reporting straight to Sentry — which is what this used to do — is
 * unfilterable: the browser POSTs violations itself, so they never pass through
 * the Sentry SDK and `beforeSend` never sees them.
 */
const CSP_REPORT_PATH = '/api/csp-report'

// Root-relative on purpose, for `report-uri` and `Reporting-Endpoints` alike.
// `report-uri` takes a URI-reference; the Reporting API resolves its endpoint
// "with base URL set to response's url" (W3C Reporting §3.3), so both land on
// whichever origin actually served the page. An absolute URL would have to be
// built from an env var and would silently point preview deploys at
// production's collector — cross-origin, so Chromium would drop those reports
// entirely, since it prefers `report-to` and ignores `report-uri` when both
// are present. Don't "fix" this to an absolute URL.

/**
 * Chain RPC endpoints, which have three independent sources that must all be
 * allowed: `rpcUrls` in src/constants/general.consts.ts (our own viem clients),
 * viem's per-chain defaults, which wagmi's bare `http()` transports fall back to
 * for external-wallet flows, and — the one this list kept missing — viem's
 * defaults for every EVM chain in src/constants/chainRegistry.consts.ts.
 *
 * That third source is the whole selectable-chain list, not just the ten wired
 * into wagmi.config: `getPublicClient` (src/app/actions/clients.ts) hands any
 * chain absent from `rpcUrls` a bare `http()`, and it is reached from client
 * code via `fetchTokenSymbol` on the token selector, whose chain list comes from
 * the API. So picking a token on Avalanche or Mantle talks to that chain's viem
 * default from the browser.
 *
 * None of these are importable here — next.config is CommonJS, the rest is TS —
 * so this list is a hand-kept mirror. Re-check it when any source gains a chain.
 */
const chainRpcHosts = [
    'https://*.core.chainstack.com',
    'https://*.publicnode.com',
    'https://*.arbitrum.io',
    'https://*.drpc.org',
    'https://mainnet.optimism.io',
    'https://mainnet.base.org',
    'https://rpc.scroll.io',
    'https://bsc-dataseed.bnbchain.org',
    'https://eth.merkle.io',
    'https://polygon-rpc.com',
    'https://rpc.gnosischain.com',
    'https://rpc.linea.build',
    'https://forno.celo.org',
    'https://*.rpc.thirdweb.com',
    // viem defaults for the remaining EVM chains in the registry. Silent in the
    // report-only data because these are rarely-picked chains, not because they
    // are unreachable — the same reason the wss:// gap stayed invisible until
    // it was looked for (#2519).
    'https://api.avax.network', // 43114 Avalanche
    'https://rpc.hyperliquid.xyz', // 999 HyperEVM
    'https://rpc-gel.inkonchain.com', // 57073 Ink
    'https://rpc-qnd.inkonchain.com', // 57073 Ink (second default)
    'https://rpc.katana.network', // 747474 Katana
    'https://rpc.mantle.xyz', // 5000 Mantle
    'https://rpc.plasma.to', // 9745 Plasma
    'https://rpc.stable.xyz', // 988 Stable
    'https://rpc.presto.tempo.xyz', // 4217 Tempo
    'https://public-en.node.kaia.io', // 8217 Kaia
]

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
 * - `chainRpcHosts` is broad (provider-level wildcards), because a single
 *   provider serves one subdomain per network.
 */
function contentSecurityPolicyReportOnly(includeReporting = true) {
    const directives = [
        "default-src 'self'",
        // PostHog is same-origin via the /relay rewrite, so it needs no entry here.
        // jsdelivr serves the mermaid bundle for /dev/kyc-flows. Dev-only route,
        // but it is a real violation on a real deployment.
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://client.crisp.chat https://static.sumsub.com https://cdn.onesignal.com https://api.onesignal.com https://cdn.jsdelivr.net",
        // Typeform injects a stylesheet from embed.typeform.com/next/css/.
        "style-src 'self' 'unsafe-inline' https://client.crisp.chat https://embed.typeform.com",
        "img-src 'self' data: blob: https:",
        "font-src 'self' data: https://client.crisp.chat",
        [
            "connect-src 'self'",
            'https://api.peanut.me',
            'https://*.peanut.me',
            // CSP treats wss: as a scheme distinct from https:, so the two
            // entries above do NOT cover the charges websocket
            // (NEXT_PUBLIC_PEANUT_WS_URL — wss://api.peanut.me in production,
            // wss://api.staging.peanut.me on staging). This gap is what makes
            // /card the single loudest violation in Sentry today, and it would
            // break the socket for every user the moment the policy is enforced.
            'wss://api.peanut.me',
            'wss://*.peanut.me',
            'https://*.ingest.sentry.io',
            'https://*.ingest.us.sentry.io',
            // Wildcarded because GA4 shards collection by region: EU traffic
            // beacons to region1.google-analytics.com, not just www. The same
            // sharding is already visible on analytics.google.com below.
            'https://*.google-analytics.com',
            // GA4 beacons to a region-specific host, and GTM's audience/conversion
            // pings go to doubleclick. The GTM container itself is fetched as
            // well as executed, so it needs a connect-src entry on top of the
            // script-src one.
            'https://analytics.google.com',
            'https://*.analytics.google.com',
            'https://stats.g.doubleclick.net',
            'https://www.googletagmanager.com',
            // Network-failure triage probe (network-triage.ts): Android's own
            // captive-portal endpoint, used to tell "device offline" from "our
            // edge unreachable" when a fetch dies without a status.
            'https://www.gstatic.com',
            // Every Google country domain, because the remarketing beacon goes
            // to the user's own — see csp-google-domains.js for why this cannot
            // be a wildcard. Supersedes the former lone 'https://www.google.com'
            // entry, which is the first element of this list.
            ...googleAdsRemarketingHosts,
            'https://rpc.zerodev.app',
            'https://*.g.alchemy.com',
            'https://rpc.ankr.com',
            'https://assets.coingecko.com',
            'https://coin-images.coingecko.com',
            // Token metadata lookup in TransactionDetailsReceipt — a different
            // CoinGecko host from the two image CDNs above.
            'https://api.coingecko.com',
            'https://ipapi.co',
            'https://api.justaname.id',
            'https://*.crisp.chat',
            'wss://client.relay.crisp.chat',
            'https://*.sumsub.com',
            // Same scheme trap as api.peanut.me above: the Sumsub WebSDK opens a
            // websocket for liveness/video-ident signalling, which the https
            // entry does not authorize. Silent in the reports only because
            // liveness is a rare path — it would still break under enforcement.
            'wss://*.sumsub.com',
            'https://widget.manteca.dev',
            'https://*.onesignal.com',
            // Testimonial avatars on the landing page. They render as <img>, so
            // img-src would normally cover them — but serwist's runtime cache
            // re-fetches them from inside sw.js, and in a service worker EVERY
            // fetch() is connect-src regardless of what the response is used
            // for. The violations arrive with document-uri https://peanut.me/sw.js
            // for exactly this reason; sw.js is served by the same /:path*
            // header rule, so it inherits this policy.
            'https://pbs.twimg.com',
            // Only reached in the SDK's single-embed mode; see frame-src below.
            'https://api.typeform.com',
            ...chainRpcHosts,
        ].join(' '),
        // Bridge is the terms-of-service iframe BridgeTosStep renders through
        // IframeWrapper — enforcing without it would dead-end KYC. Wildcarded
        // like *.sumsub.com because the URL is chosen by the provider at
        // runtime (compliance.bridge.xyz today) rather than by us. Crisp is
        // wildcarded to match connect-src: the widget pulls attachments from
        // assets.crisp.chat, not just client.
        // form.typeform.com is the SDK's DEFAULT_DOMAIN — the iframe the feedback
        // Widget in Global/Layout renders. Currently unreachable (its Modal is
        // never opened), so it produces no violations today; allow-listed because
        // re-arming it is a one-line change and the failure would be a blank
        // iframe under enforcement.
        "frame-src 'self' https://*.crisp.chat https://*.sumsub.com https://widget.manteca.dev https://mpago.la https://*.bridge.xyz https://form.typeform.com",
        "worker-src 'self' blob:",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
    ]
    // Both delivery mechanisms on purpose: `report-uri` is deprecated but what
    // Firefox/Safari actually send today, `report-to` (backed by the
    // Reporting-Endpoints header below) is what replaces it in Chromium.
    // Shipping only one would undercount violations and promote the policy on
    // a partial picture.
    if (includeReporting) directives.push(`report-uri ${CSP_REPORT_PATH}`, `report-to ${CSP_REPORT_GROUP}`)
    return directives.join('; ')
}

const CSP_REPORT_GROUP = 'csp-endpoint'

function reportingEndpointsHeader() {
    return [{ key: 'Reporting-Endpoints', value: `${CSP_REPORT_GROUP}="${CSP_REPORT_PATH}"` }]
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

// Mirrors DEV_TOOLS_ENABLED in src/constants/dev-tools.consts.ts. Kept in sync
// by hand: the constant cannot be imported here (this file is CommonJS and runs
// before the TS pipeline), and the two disagreeing would ship a dev chunk or
// break the ds-shots preview build.
const devToolsEnabled =
    process.env.NODE_ENV === 'development' ||
    (process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.VERCEL_ENV ?? '') === 'preview'

/** @type {import('next').NextConfig} */
let nextConfig = {
    env: {
        NEXT_PUBLIC_GIT_COMMIT_HASH: gitCommitHash,
        // Vercel injects VERCEL_ENV and VERCEL_GIT_COMMIT_REF server-side at
        // build time. Re-export as NEXT_PUBLIC_* so the client bundle (and
        // src/utils/sentry-env.ts in particular) can read them too.
        // The `?? ''` matters: next skips null env values, and only a defined
        // value is statically inlined by webpack's DefinePlugin. The /dev
        // build-time gates (dev/ds/audit pages, DEV_TOOLS_ENABLED) need the
        // literal so their `=== 'preview'` check folds to a constant and the
        // dev-only data is tree-shaken out of non-Vercel prod builds.
        // respect an explicitly-set build env first (the ds-shots CI job sets
        // NEXT_PUBLIC_VERCEL_ENV=preview so fixture mode engages), then Vercel's
        // own var, else '' so the audit-gate condition still folds to a literal.
        NEXT_PUBLIC_VERCEL_ENV: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.VERCEL_ENV ?? '',
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
        // 16.3.1 predates the 16.3.3 fix for GHSA-2xp9-vwfh-vxw4: decoding an
        // attacker-supplied AVIF through sharp/libheif is RCE. Production is
        // covered by Vercel's managed optimizer, which has AVIF disabled
        // platform-side, and the native export is already unoptimized — but a
        // dev server runs the optimizer in-process, and remotePatterns below
        // is a wildcard, so any page a developer visits can drive
        // /_next/image?url=<attacker>.avif. `unoptimized` 404s the endpoint
        // before the upstream fetch. Drop this line when the release-age floor
        // allows 16.3.4.
        unoptimized: process.env.NODE_ENV === 'development',
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
            // The /dev/surfaces gallery mounts ~50 app components. Its route
            // gate keeps it from answering outside dev/preview, and its dynamic
            // import keeps it out of the eager graph — but a chunk is still
            // emitted for every import() in source. Swap the registry for an
            // empty stub on the builds that can never render it, so production
            // and the native export stop carrying it.
            ...(devToolsEnabled ? {} : { '@/dev/surfaces/registry': './src/dev/surfaces/registry.prod-stub.ts' }),
        },
    },

    // Disable source maps in production (already handled by Sentry)
    productionBrowserSourceMaps: false,

    // AGENTS.md and CLAUDE.md are both tracked symlinks to ../AGENTS.md, so
    // Next 16.3's default agent-rules writer would follow them out of the repo
    // and overwrite mono's shared instructions on `next dev`.
    agentRules: false,

    // Transpile packages for better compatibility
    transpilePackages: ['@squirrel-labs/peanut-sdk'],

    // react-pdf's ESM graph (yoga wasm, pdfkit) breaks when webpack bundles it
    // into the server build — load it from node_modules at runtime instead.
    serverExternalPackages: ['@react-pdf/renderer'],

    // Font.register reads these paths inside react-pdf, invisible to the
    // file tracer — include them for the deployed serverless function.
    outputFileTracingIncludes: {
        '/receipt/[entryId]/pdf': ['./src/assets/fonts/*.ttf'],
    },

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

    webpack: (config, { isServer, dev, webpack }) => {
        // `pnpm build` is `next build --webpack`, and the native builder runs the
        // same webpack path — so a turbopack resolveAlias alone never reaches a
        // build the repo actually runs. A resolve.alias does not work either:
        // Next maps the `@/*` tsconfig path itself, before this alias is
        // consulted. NormalModuleReplacementPlugin rewrites the resolved
        // request, which is the one hook that survives both. Without it,
        // production and the native export emit a chunk for the dev-surfaces
        // registry and its ~50 component imports on a route that cannot answer.
        if (!devToolsEnabled) {
            config.plugins.push(
                new webpack.NormalModuleReplacementPlugin(
                    /dev[\\/]surfaces[\\/]registry$/,
                    path.resolve(__dirname, 'src/dev/surfaces/registry.prod-stub.ts')
                )
            )
        }
        if (!dev || !process.env.NEXT_TURBO) {
            if (isServer) {
                config.ignoreWarnings = [{ module: /@opentelemetry\/instrumentation/, message: /Critical dependency/ }]
            }
        }

        return config
    },
    reactStrictMode: false,
    // Do NOT remove. Next's built-in trailing-slash redirect is global, and the
    // PostHog reverse proxy below (/relay/*) is hit with trailing slashes by the
    // SDK's POSTs (/relay/decide/, /relay/e/). A 308 on those either drops the
    // body or costs every event an extra round trip, so the automatic redirect
    // stays off.
    //
    // The SEO problem it leaves behind — /en/help/ and /en/help both returning
    // 200 — is solved narrowly instead: redirects.json ends with a
    // `/:locale(en|es-419|es-ar|pt-br)/:path*/` -> slashless permanent (308)
    // redirect, which only covers the locale-prefixed marketing tree and cannot
    // touch /relay, /monitoring, /passkeys or the recipient catch-all. Keep that
    // locale list in sync with SUPPORTED_LOCALES (src/i18n/types.ts).
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
        // Campaign/invite links on the root domain (peanut.me/?campaign=skip,
        // peanut.me/?code=alice) hand off to /invite, which owns the claim flow.
        // Query params carry over automatically. Deliberately NOT keyed on
        // utm_campaign — that would hijack ordinary marketing links to the
        // landing page; utm_campaign only resolves to a badge once on /invite.
        // Active in development too (unlike the locale redirects) so the flow is
        // locally testable.
        const campaignRedirects = ['campaign', 'campaignTag', 'code'].map((key) => ({
            source: '/',
            has: [{ type: 'query', key }],
            destination: '/invite',
            permanent: false,
        }))
        return process.env.NODE_ENV === 'development' ? campaignRedirects : [...campaignRedirects, ...redirectsConfig]
    },
    async headers() {
        return [
            // App/auth/transaction surfaces must never inherit the root
            // marketing metadata's index directive. HTTP directives work for
            // client layouts and preserve social-card crawling.
            ...buildNoindexHeaderRules(),
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
                    ...reportingEndpointsHeader(),
                    { key: 'X-Content-Type-Options', value: 'nosniff' },
                    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
                ],
            },
            {
                source: '/dev/payment-graph',
                headers: [
                    { key: 'Cache-Control', value: 'private, no-store, max-age=0, must-revalidate' },
                    { key: 'Pragma', value: 'no-cache' },
                    { key: 'Referrer-Policy', value: 'no-referrer' },
                    { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
                    // The document URL can contain a legacy ?password=
                    // credential before synchronous client scrubbing.
                    // Keep the report-only policy, but never register a report
                    // delivery directive that could serialize that URL.
                    { key: 'Content-Security-Policy-Report-Only', value: contentSecurityPolicyReportOnly(false) },
                    { key: 'Reporting-Endpoints', value: 'csp-disabled="/api/csp-report-disabled"' },
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

        // Off: annotation stamps data-sentry-* attributes on every DOM node, which
        // its only consumer (session replay) doesn't run — pure DOM weight.
        reactComponentAnnotation: {
            enabled: false,
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
