/** @type {import('next').NextConfig} */
const { withSentryConfig } = require('@sentry/nextjs')

const nextConfig = {
    env: {
        WC_PROJECT_ID: process.env.WC_PROJECT_ID,
        SOCKET_API_KEY: process.env.SOCKET_API_KEY,
        PEANUT_API_KEY: process.env.PEANUT_API_KEY,
        GA_KEY: process.env.GA_KEY,
        PROMO_LIST: process.env.PROMO_LIST,
        SENTRY_DSN: process.env.SENTRY_DSN,
        SENTRY_AUTH_TOKEN: process.env.SENTRY_AUTH_TOKEN,
    },
    productionBrowserSourceMaps: true,
    swcMinify: true,
    sentry: {
        hideSourceMaps: true,
    },
}

const sentryWebpackPluginOptions = {
    // Additional config options for the Sentry webpack plugin. Keep in mind that
    // the following options are set automatically, and overriding them is not
    // recommended:
    //   release, url, configFile, stripPrefix, urlPrefix, include, ignore

    org: 'peanut-c34d84c05',
    project: 'peanut-ui',

    // An auth token is required for uploading source maps.
    // You can get an auth token from https://sentry.io/orgredirect/organizations/:orgslug/settings/auth-tokens/
    authToken: process.env.SENTRY_AUTH_TOKEN,

    silent: true, // Suppresses all logs

    // For all available options, see:
    // https://github.com/getsentry/sentry-webpack-plugin#options.
}

module.exports = withSentryConfig(nextConfig, sentryWebpackPluginOptions)
