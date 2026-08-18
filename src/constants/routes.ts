/**
 * Centralized route configuration
 *
 * This file defines all route categories used across the app to avoid duplication
 * and ensure consistency between layout.tsx, middleware.ts, and catch-all routes.
 */

/**
 * Routes with dedicated Next.js page files
 * These should not be handled by catch-all routes
 */
export const DEDICATED_ROUTES = [
    // App routes (auth-gated)
    'qr',
    'api',
    'setup',
    'home',
    'history',
    'settings',
    'points',
    'rewards',
    'claim',
    'pay',
    'pay-request',
    'request',
    'invite',
    'support',
    'dev',
    'send',
    'profile',
    'kyc',
    'maintenance',
    'quests',
    'receipt',
    'crisp-proxy',
    'card',
    'card-payment',
    'add-money',
    'withdraw',
    'sdk',
    'qr-pay',
    'badges',
    'limits',
    'notifications',
    'recover-funds',
    'card-recovery',
    'recover-wallet',
    'fix-card-signature',

    // Public pages (existing)
    'app', // smart store link (/app) — QR codes point here, redirects by device
    'm', // merchant landing pages (/m/[slug]) — added on main; register so the catch-all never treats it as a recipient
    'careers',
    'jobs',
    'privacy',
    'terms',
    'lp',
    'exchange',
    'shhhhh',

    // Future SEO routes (pre-register so catch-all doesn't intercept)
    'send-money-to',
    'receive-money-from',
    'deposit',
    'pay-with',
    'convert',
    'compare',
    'blog',
    'help',
    'faq',
    'how-it-works',

    // Marketing hubs that already ship as [locale]/(marketing) pages but whose
    // bare paths were still recipient-shaped (7 lowercase letters each), so
    // /pricing, /stories and /content rendered a payment-profile shell on a 200
    // instead of resolving to the real page. Reserved here + 301'd to /en/… in
    // redirects.json. NOTE: 'pricing' is also reserved server-side (the username
    // API rejects it), but 'stories' and 'content' are still claimable as
    // usernames — see the PR body, backend needs to add them to its reserved list.
    'pricing',
    'stories',
    'content',

    // Locale prefixes (current SUPPORTED_LOCALES)
    'en',
    'es-419',
    'es-ar',
    'pt-br',

    // Retired locales — still 301'd in redirects.json, kept reserved so a stale
    // URL can never be read as a recipient username by the catch-all route.
    'es-es',
] as const

/**
 * Routes from redirects.json (static redirects)
 * These are handled by Next.js redirects configuration
 */
export const STATIC_REDIRECT_ROUTES = [
    'docs',
    'packet',
    'create-packet',
    'batch',
    'raffle',
    'pioneers',
    'pints',
    'events',
    'foodie',
] as const

/**
 * All reserved routes that should not be handled by catch-all recipient route
 * Combination of dedicated routes and static redirects
 */
export const RESERVED_ROUTES: readonly string[] = [...DEDICATED_ROUTES, ...STATIC_REDIRECT_ROUTES]

/**
 * Regex pattern for public routes (used in layout.tsx)
 * Matches paths that don't require authentication
 *
 * Note: Most dev tools routes are NOT public - they require both authentication and specific user authorization
 * Exception: /dev/payment-graph is public (uses API key instead of user auth)
 */
export const PUBLIC_ROUTES_REGEX = /^\/(request\/pay|claim|pay\/.+|support|invite|qr|profile\/view|dev\/payment-graph)/

/**
 * Regex for dev-only public routes: ALL /dev pages (index + every tool/preview).
 * Only matched when IS_DEV is true (build-time NODE_ENV==='development'), so this
 * never applies on prod/preview builds. /dev is also independently notFound()'d on
 * peanut.me by dev/layout.tsx (except full-graph/payment-graph), so dev tooling is
 * doubly walled off from prod — this just removes the login-redirect friction locally.
 */
export const DEV_ONLY_PUBLIC_ROUTES_REGEX = /^\/dev(\/|$)/

/**
 * Matches locale tags with a required subtag to avoid false-positives on short
 * strings like "go", "no", "max" that are valid usernames. Covers patterns like
 * "pt-br", "es-419", "zh-Hans", "zh-Hans-CN" but NOT bare 2-letter codes (those
 * must be listed explicitly in DEDICATED_ROUTES).
 */
const LOCALE_WITH_SUBTAG = /^[a-z]{2,3}-[a-z0-9]{2,8}(-[a-z0-9]{2,8})*$/i

/**
 * Helper to check if a path segment looks like a locale code.
 * Bare 2-3 letter codes (en, es, pt) are caught by DEDICATED_ROUTES.
 * This handles subtag variants (pt-br, es-419, zh-Hans) that aren't listed explicitly.
 */
export function isLocaleSegment(segment: string): boolean {
    return LOCALE_WITH_SUBTAG.test(segment)
}

/**
 * Helper to check if a path is reserved (should not be handled by catch-all)
 */
export function isReservedRoute(path: string): boolean {
    const firstSegment = path.split('/')[1]?.toLowerCase()
    if (!firstSegment) return false
    return RESERVED_ROUTES.includes(firstSegment) || isLocaleSegment(firstSegment)
}

/**
 * Username validation — mirror of the rule in src/components/Setup/Views/Signup.tsx
 * (4-12 chars, lowercase letters + digits, must start with a letter). If we widen
 * this server-side, update both call sites.
 */
const USERNAME_PATTERN = /^[a-z][a-z0-9]{3,11}$/

/** Whether a path segment is shaped like a bare Peanut username — as opposed
 *  to an address, ENS name, or `user@chain` handle (see couldBeRecipient). */
export function isPlausibleUsername(segment: string): boolean {
    try {
        return USERNAME_PATTERN.test(decodeURIComponent(segment).toLowerCase())
    } catch {
        return false
    }
}

/**
 * Helper to check if a first segment could plausibly identify a payment recipient:
 * a Peanut username, an EVM address, an ENS name, or a `username@chain` handle.
 * Anything else (bare locale codes, random strings, things with dashes/dots) should
 * 404 instead of falling through to the recipient catch-all and rendering a profile.
 */
export function couldBeRecipient(segment: string): boolean {
    if (!segment) return false
    let decoded: string
    try {
        decoded = decodeURIComponent(segment).toLowerCase()
    } catch {
        // malformed percent-encoding (e.g. lone '%') → not a recipient
        return false
    }
    // strip the @chain suffix first so address@chainId deep links (e.g. the
    // QR scanner's EIP-681 path builds /0x…@42161/34.4USDC) pass the guard —
    // chain validation happens downstream in the url parser
    const base = decoded.split('@')[0]
    // EVM address
    if (/^0x[0-9a-f]{40}$/.test(base)) return true
    // ENS name
    if (base.endsWith('.eth') && base.length > 4) return true
    // username@chain handle
    return USERNAME_PATTERN.test(base)
}

/**
 * Helper to check if a path is public (no auth required)
 * Dev test pages (gift-test, shake-test) are only public in dev mode
 */
export function isPublicRoute(path: string, isDev = false): boolean {
    if (PUBLIC_ROUTES_REGEX.test(path)) {
        return true
    }
    // Dev test pages are only public in dev mode
    if (isDev && DEV_ONLY_PUBLIC_ROUTES_REGEX.test(path)) {
        return true
    }
    return false
}
