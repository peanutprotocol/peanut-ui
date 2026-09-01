/**
 * Search-engine policy for non-marketing surfaces.
 *
 * Keep this file as plain CommonJS so both Next's build-time config and the
 * TypeScript app can consume the same route inventory.
 */

const NOINDEX_ROUTE_PREFIXES = Object.freeze([
    '/app',
    '/sdk',
    '/home',
    '/profile',
    '/settings',
    '/send',
    '/request',
    '/setup',
    '/claim',
    '/pay',
    '/pay-request',
    '/dev',
    '/qr',
    '/qr-pay',
    '/history',
    '/points',
    '/rewards',
    '/invite',
    '/kyc',
    '/maintenance',
    '/quests',
    '/receipt',
    '/crisp-proxy',
    '/card',
    '/card-payment',
    '/add-money',
    '/withdraw',
    '/badges',
    '/limits',
    '/notifications',
    '/recover-funds',
    '/card-recovery',
    '/recover-wallet',
    '/fix-card-signature',
])

// Personalized images can include usernames and payment amounts. Keep only
// the base endpoint out of search; `/api/og/marketing` is a separate public
// route used by indexable landing pages.
const NOINDEX_EXACT_ROUTES = Object.freeze(['/api/og'])

// These paths should not be crawled at all. A route can be both noindex and
// disallowed: the HTTP directive protects it if a crawler reaches it through
// another mechanism, while robots.txt avoids routine discovery crawling.
const ROBOTS_DISALLOWED_PATHS = Object.freeze([
    '/api/',
    '/sdk/',
    '/home',
    '/profile',
    '/settings',
    '/send',
    '/request',
    '/setup',
    '/claim',
    '/pay',
    '/dev/',
    '/qr',
    '/history',
    '/points',
    '/rewards',
    '/invite',
    '/kyc',
    '/maintenance',
    '/quests',
    '/receipt',
    '/crisp-proxy',
    '/card-payment',
    '/add-money',
    '/withdraw',
])

// GSC shows these exact shells (or their invite query variants) in Google's
// index. They need a narrow crawl exception so search engines can observe and
// refresh the X-Robots-Tag. Descendant transaction/profile URLs remain
// blocked. Keep the exceptions while these routes exist; only remove one once
// its route returns 404/410 or permanently redirects to a safe target.
const GOOGLE_DEINDEX_CRAWL_ALLOW_PATHS = Object.freeze([
    '/home$',
    '/profile$',
    '/send$',
    '/setup$',
    '/invite$',
    '/invite?code=',
])

const NOINDEX_HEADER = Object.freeze({ key: 'X-Robots-Tag', value: 'noindex, nofollow' })

/**
 * Fail-closed production check for indexability decisions. BASE_URL
 * deliberately falls back to production for links, but that fallback must not
 * make an unset preview environment indexable — so derive from the RAW env
 * value: only an explicitly configured production origin counts.
 *
 * @param {string | undefined} rawBaseUrl usually process.env.NEXT_PUBLIC_BASE_URL
 * @returns {boolean}
 */
function isProductionDomain(rawBaseUrl) {
    return rawBaseUrl?.replace(/\/$/, '') === 'https://peanut.me'
}

function buildNoindexHeaderRules() {
    return [
        ...NOINDEX_EXACT_ROUTES.map((source) => ({ source, headers: [NOINDEX_HEADER] })),
        ...NOINDEX_ROUTE_PREFIXES.map((source) => ({
            source: `${source}/:path*`,
            headers: [NOINDEX_HEADER],
        })),
    ]
}

module.exports = {
    GOOGLE_DEINDEX_CRAWL_ALLOW_PATHS,
    NOINDEX_HEADER,
    NOINDEX_EXACT_ROUTES,
    NOINDEX_ROUTE_PREFIXES,
    ROBOTS_DISALLOWED_PATHS,
    buildNoindexHeaderRules,
    isProductionDomain,
}
