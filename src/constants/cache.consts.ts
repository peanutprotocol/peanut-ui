/**
 * Service Worker cache name constants
 * Used across sw.ts and authContext.tsx to ensure consistent cache management
 */

/**
 * Base cache names (without version suffix)
 */
export const CACHE_NAMES = {
    USER_API: 'user-api',
    TRANSACTIONS: 'transactions-api',
    KYC_MERCHANT: 'kyc-merchant-api',
    PRICES: 'prices-api',
    EXTERNAL_RESOURCES: 'external-resources',
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
 * Generates a versioned cache name
 * @param name - Base cache name
 * @param version - Cache version string
 * @returns Versioned cache name (e.g., "user-api-v1")
 */
export const getCacheNameWithVersion = (name: string, version: string): string => {
    return `${name}-${version}`
}
