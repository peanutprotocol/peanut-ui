/** Non-secret; the public API whose health this page reports. */
const PRODUCTION_API_URL = 'https://api.peanut.me'

/**
 * Which API serves this page's 72h feed.
 *
 * Always production, in every environment. A status page is a monitoring
 * surface rather than part of the app: it has to report the health of the
 * system users are actually on, so a preview or a local run rendering
 * staging's health under a production banner would be worse than showing
 * nothing. That also keeps a broken staging deploy from reading as an outage.
 *
 * `STATUS_API_URL` overrides it, for local work against a fixture or for
 * pointing a review build at another backend on purpose.
 */
export function statusFeedOrigin(): string {
    const override = process.env.STATUS_API_URL
    if (override) return override.replace(/\/$/, '')

    return PRODUCTION_API_URL
}
