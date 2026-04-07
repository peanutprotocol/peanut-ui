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

    env: {
        NEXT_PUBLIC_GIT_COMMIT_HASH: gitCommitHash,
        // Flag to detect native context in code
        NEXT_PUBLIC_IS_NATIVE_BUILD: 'true',
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

    webpack: (config, { isServer, dev }) => {
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
