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

    // Public pages (existing)
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

    // Locale prefixes (current SUPPORTED_LOCALES)
    'en',
    'es-419',
    'es-ar',
    'es-es',
    'pt-br',
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
export const PUBLIC_ROUTES_REGEX = /^\/(request\/pay|claim|pay\/.+|support|invite|qr|dev\/payment-graph)/

/**
 * Regex for dev-only public routes (dev index, gift-test, shake-test)
 * Only matched when IS_DEV is true
 */
export const DEV_ONLY_PUBLIC_ROUTES_REGEX =
    /^\/(dev$|dev\/gift-test|dev\/shake-test|dev\/ds|dev\/components|dev\/share-builder|dev\/rejection-builder)/

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
    return RESERVED_ROUTES.includes(firstSegment as any) || isLocaleSegment(firstSegment)
}

/**
 * Username validation — mirror of the rule in src/components/Setup/Views/Signup.tsx
 * (4-12 chars, lowercase letters + digits, must start with a letter). If we widen
 * this server-side, update both call sites.
 */
const USERNAME_PATTERN = /^[a-z][a-z0-9]{3,11}$/

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
    // EVM address
    if (/^0x[0-9a-f]{40}$/.test(decoded)) return true
    // ENS name
    if (decoded.endsWith('.eth') && decoded.length > 4) return true
    // username@chain handle (chain validation happens downstream)
    const base = decoded.includes('@') ? decoded.split('@')[0] : decoded
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
