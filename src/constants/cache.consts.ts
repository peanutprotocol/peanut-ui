/**
 * Service Worker cache name constants
 * Used across sw.ts and authContext.tsx to ensure consistent cache management
 */

const CACHE_NAMES = {
    USER_API: 'user-api',
    TRANSACTIONS: 'transactions-api',
    KYC_MERCHANT: 'kyc-merchant-api',
    PAGES: 'pages',
    PAGES_RSC: 'pages-rsc',
    PAGES_RSC_PREFETCH: 'pages-rsc-prefetch',
    OTHERS: 'others',
} as const

/**
 * Cache names that contain user-specific data
 * These should be cleared on logout to prevent data leakage between users
 */
export const USER_DATA_CACHE_PATTERNS = [
    CACHE_NAMES.USER_API,
    CACHE_NAMES.TRANSACTIONS,
    CACHE_NAMES.KYC_MERCHANT,
] as const

/**
 * Serwist's `defaultCache` document caches (see src/app/sw.ts, which spreads
 * `...defaultCache` from @serwist/next/worker).
 *
 * A cached `Response` keeps the headers it was stored with, so a document
 * served back out of these caches replays that deployment's
 * Content-Security-Policy-Report-Only — which is how weeks-old policies kept
 * reporting violations long after the allow-list was fixed. Purge them before
 * reloading onto a new deployment, or the reload can be answered from cache.
 *
 * Note `others` is the one that actually matches browser navigations: the
 * `pages` rule keys off a Content-Type request header that navigations don't
 * send, so it is effectively dead. Both are listed rather than relying on that.
 */
export const DOCUMENT_CACHE_PATTERNS = [
    CACHE_NAMES.PAGES,
    CACHE_NAMES.PAGES_RSC,
    CACHE_NAMES.PAGES_RSC_PREFETCH,
    CACHE_NAMES.OTHERS,
] as const
