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
 * Note: 'dev' routes require authentication and specific user authorization (not public)
 */
export const PUBLIC_ROUTES = ['request/pay', 'claim', 'pay', 'support', 'invite', 'qr'] as const

/**
 * Regex pattern for public routes (used in layout.tsx)
 * Matches paths that don't require authentication
 *
 * Note: Dev tools routes are NOT public - they require both authentication and specific user authorization
 */
export const PUBLIC_ROUTES_REGEX = /^\/(request\/pay|claim|pay\/.+|support|invite|qr)/

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
 */
export function isPublicRoute(path: string): boolean {
    return PUBLIC_ROUTES_REGEX.test(path)
}
