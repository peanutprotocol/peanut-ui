// Mirrors DEV_TOOLS_ENABLED in src/constants/dev-tools.consts.ts — the native
// export can never answer a /dev route, so the surfaces registry is stubbed out
// rather than compiled into the bundle.
const path = require('path')
const devToolsEnabled =
    process.env.NODE_ENV === 'development' ||
    (process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.VERCEL_ENV ?? '') === 'preview'

const os = require('os')
const { execSync } = require('child_process')
const withBundleAnalyzer = require('@next/bundle-analyzer')({
    enabled: false, // Disable for native builds
})

// Get git commit hash at build time
let gitCommitHash = 'unknown'
try {
    gitCommitHash = execSync('git rev-parse --short=7 HEAD').toString().trim()
} catch (error) {
    console.warn('Could not get git commit hash:', error.message)
}

/** @type {import('next').NextConfig} */
let nextConfig = {
    // STATIC EXPORT FOR CAPACITOR
    output: 'export',

    // Disable image optimization (requires server)
    images: {
        unoptimized: true,
    },

    // Required for Capacitor - assets must use relative paths
    assetPrefix: '',

    // Trailing slashes help with static file serving
    trailingSlash: true,

    // This build renames dynamic routes out of the tree, so the tests that
    // import them stop resolving. Next 16.3 type-checks them where 16.2 did
    // not; `pnpm typecheck` still covers them against the intact tree.
    typescript: {
        tsconfigPath: 'tsconfig.native.json',
    },

    env: {
        NEXT_PUBLIC_GIT_COMMIT_HASH: gitCommitHash,
        // Flag to detect native context in code
        NEXT_PUBLIC_IS_NATIVE_BUILD: 'true',
        // required for isCapacitor() detection — ensures all API calls use direct backend URLs
        NEXT_PUBLIC_CAPACITOR_BUILD: 'true',
        // native builds never run on Vercel; define the literal so the /dev
        // build-time gates fold to false and dev-only data is tree-shaken out
        NEXT_PUBLIC_VERCEL_ENV: '',
    },

    // Transpile packages for better compatibility
    transpilePackages: ['@squirrel-labs/peanut-sdk'],

    // Experimental features for optimization
    experimental: {
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
        if (!dev) {
            if (isServer) {
                config.ignoreWarnings = [{ module: /@opentelemetry\/instrumentation/, message: /Critical dependency/ }]
            }
        }
        return config
    },

    reactStrictMode: false,

    // Note: rewrites, redirects, and headers don't work with static export
    // These would need to be handled by your backend or Capacitor plugins
}

module.exports = withBundleAnalyzer(nextConfig)
