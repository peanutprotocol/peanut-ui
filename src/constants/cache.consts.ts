/**
 * Service Worker cache name constants
 * Used across sw.ts and authContext.tsx to ensure consistent cache management
 */

const CACHE_NAMES = {
    USER_API: 'user-api',
    TRANSACTIONS: 'transactions-api',
    KYC_MERCHANT: 'kyc-merchant-api',
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
