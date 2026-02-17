/**
 * Shared retry utilities for network resilience
 * Provides consistent retry strategies across the application
 */

/**
 * Creates an exponential backoff function
 * Delays increase exponentially: baseDelay, baseDelay*2, baseDelay*4, etc., up to maxDelay
 *
 * @param baseDelay - Initial delay in milliseconds (default: 1000ms)
 * @param maxDelay - Maximum delay in milliseconds (default: 5000ms)
 * @returns Function that calculates delay for a given attempt index
 */
export const createExponentialBackoff = (baseDelay: number = 1000, maxDelay: number = 5000) => {
    return (attemptIndex: number) => Math.min(baseDelay * 2 ** attemptIndex, maxDelay)
}

/**
 * Predefined retry strategies for different use cases
 */
export const RETRY_STRATEGIES = {
    /**
     * Fast retry: 2 retries with exponential backoff (1s, 2s, max 5s)
     * Use for: User-facing queries that need quick feedback
     */
    FAST: {
        retry: 2,
        retryDelay: createExponentialBackoff(1000, 5000),
    },

    /**
     * Standard retry: 3 retries with exponential backoff (1s, 2s, 4s, max 30s)
     * Use for: Background queries, non-critical data
     */
    STANDARD: {
        retry: 3,
        retryDelay: createExponentialBackoff(1000, 30000),
    },

    /**
     * Aggressive retry: 4 retries with exponential backoff (1s, 2s, 4s, 8s, max 10s)
     * Use for: Critical data that must succeed
     */
    AGGRESSIVE: {
        retry: 4,
        retryDelay: createExponentialBackoff(1000, 10000),
    },

    /**
     * No retry: Financial transactions must not be retried automatically
     * Use for: Payments, withdrawals, claims - any operation that transfers funds
     */
    FINANCIAL: {
        retry: false,
    },
} as const

/**
 * Generic async retry wrapper with exponential backoff.
 * Use for imperative code outside of React Query (e.g. kernel client init).
 *
 * @param fn - Async function to retry. Return value is forwarded on success.
 * @param options.maxRetries - Total retry attempts after the first failure (default: 2)
 * @param options.baseDelay - Initial delay in ms before first retry (default: 1000)
 * @param options.maxDelay - Cap on delay in ms (default: 5000)
 * @param options.shouldRetry - Optional predicate; return false to bail early
 * @returns The resolved value of `fn`
 */
export async function retryAsync<T>(
    fn: () => Promise<T>,
    {
        maxRetries = 2,
        baseDelay = 1000,
        maxDelay = 5000,
        shouldRetry,
    }: {
        maxRetries?: number
        baseDelay?: number
        maxDelay?: number
        shouldRetry?: (error: unknown, attempt: number) => boolean
    } = {}
): Promise<T> {
    const backoff = createExponentialBackoff(baseDelay, maxDelay)
    let lastError: unknown
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn()
        } catch (error) {
            lastError = error
            if (attempt === maxRetries) break
            if (shouldRetry && !shouldRetry(error, attempt)) break
            await new Promise((r) => setTimeout(r, backoff(attempt)))
        }
    }
    throw lastError
}
