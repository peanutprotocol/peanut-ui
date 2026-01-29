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
    'qr',
    'api',
    'setup',
    'home',
    'history',
    'settings',
    'points',
    'claim',
    'pay',
    'request',
    'invite',
    'support',
    'dev',
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
 * Routes accessible without authentication
 * These paths can be accessed by non-logged-in users
 *
 * Note: Most 'dev' routes require authentication and specific user authorization
 * Exception: /dev/payment-graph is public (uses API key instead of user auth)
 */
export const PUBLIC_ROUTES = ['request/pay', 'claim', 'pay', 'support', 'invite', 'qr', 'dev/payment-graph'] as const

/**
 * Dev test routes that are public only in dev mode
 */
export const DEV_ONLY_PUBLIC_ROUTES = ['dev', 'dev/gift-test', 'dev/shake-test'] as const

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
export const DEV_ONLY_PUBLIC_ROUTES_REGEX = /^\/(dev$|dev\/gift-test|dev\/shake-test)/

/**
 * Routes where middleware should run
 *
 * NOTE: This is for documentation only. Next.js middleware config.matcher
 * must be a static literal array (can't import constants) for build-time parsing.
 * The actual matcher is defined directly in middleware.ts
 */
export const MIDDLEWARE_ROUTES: readonly string[] = [
    '/',
    '/home',
    '/claim/:path*',
    '/api/:path*',
    '/home/:path*',
    '/profile/:path*',
    '/send/:path*',
    '/request/:path*',
    '/settings/:path*',
    '/setup/:path*',
    '/share/:path*',
    '/history/:path*',
    '/raffle/:path*',
    '/c/:path*',
    '/pay/:path*',
    '/p/:path*',
    '/link/:path*',
    '/dev/:path*',
    '/qr/:path*',
]

/**
 * Helper to check if a path is reserved (should not be handled by catch-all)
 */
export function isReservedRoute(path: string): boolean {
    const firstSegment = path.split('/')[1]?.toLowerCase()
    return RESERVED_ROUTES.includes(firstSegment as any)
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
