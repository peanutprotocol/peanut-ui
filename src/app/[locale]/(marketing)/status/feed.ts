import { PEANUT_API_URL } from '@/constants/general.consts'

/** Non-secret; already the default in .env.example. */
const STAGING_API_URL = 'https://api.staging.peanut.me'

/**
 * Which API serves this page's 72h feed.
 *
 * Preview deployments read staging. A preview exists to review unreleased
 * code, and the backend half of this page ships on the same cycle — until
 * `dev` reaches `main`, production's API answers `/status/summary` with a 404
 * and every preview renders the "could not be loaded" state instead of the
 * thing under review. Reviewing the page against staging is also the honest
 * pairing: preview frontend, preview-era backend.
 *
 * `STATUS_API_URL` overrides both, because a status page is a monitoring
 * surface and there are legitimate reasons to point it at a backend other
 * than the one the app itself talks to.
 */
export function statusFeedOrigin(): string {
    const override = process.env.STATUS_API_URL
    if (override) return override.replace(/\/$/, '')

    // VERCEL_ENV is server-side; next.config re-exports it as NEXT_PUBLIC_* for
    // the client bundle (see src/utils/sentry-env.ts, same fallback pair).
    const vercelEnv = process.env.VERCEL_ENV ?? process.env.NEXT_PUBLIC_VERCEL_ENV
    if (vercelEnv === 'preview') return STAGING_API_URL

    return PEANUT_API_URL
}
