/**
 * Retry utilities with exponential backoff
 *
 * @module utils/retry
 */

export interface RetryOptions {
    /** Maximum number of retry attempts (default: 3) */
    maxRetries?: number
    /** Initial delay in milliseconds (default: 1000) */
    initialDelay?: number
    /** Maximum delay in milliseconds (default: 30000 = 30s) */
    maxDelay?: number
    /** Multiplier for exponential backoff (default: 2) */
    backoffMultiplier?: number
    /** Add random jitter to delays (default: false) */
    jitter?: boolean
    /** Function called on each retry (for logging) */
    onRetry?: (attempt: number, error: Error, nextDelay: number) => void
    /** Function to determine if error is retryable (default: all errors retryable) */
    shouldRetry?: (error: Error) => boolean
}

/**
 * Executes a function with exponential backoff retry logic
 *
 * @example
 * ```typescript
 * const result = await retryWithBackoff(
 *   async () => await fetchDataFromAPI(),
 *   {
 *     maxRetries: 3,
 *     initialDelay: 1000,
 *     onRetry: (attempt, error, delay) => {
 *       console.log(`Retry ${attempt}/3 after ${delay}ms: ${error.message}`)
 *     }
 *   }
 * )
 * ```
 */
export async function retryWithBackoff<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
    const {
        maxRetries = 3,
        initialDelay = 1000,
        maxDelay = 30000,
        backoffMultiplier = 2,
        jitter = false,
        onRetry,
        shouldRetry = () => true,
    } = options

    let lastError: Error | null = null

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await fn()
        } catch (error) {
            lastError = error as Error

            // Check if we should retry this error
            if (!shouldRetry(lastError)) {
                throw lastError
            }

            // If this was the last attempt, throw
            if (attempt === maxRetries - 1) {
                throw lastError
            }

            // Calculate delay with exponential backoff
            let delay = Math.min(maxDelay, initialDelay * Math.pow(backoffMultiplier, attempt))

            // Add jitter if enabled (±25% randomness)
            if (jitter) {
                const jitterAmount = delay * 0.25
                delay = delay + (Math.random() * 2 - 1) * jitterAmount
            }

            // Call onRetry callback if provided
            if (onRetry) {
                onRetry(attempt + 1, lastError, delay)
            }

            // Wait before next attempt
            await new Promise((resolve) => setTimeout(resolve, delay))
        }
    }

    // This should never be reached due to throw in loop, but TypeScript needs it
    throw lastError || new Error('Retry failed with unknown error')
}

/**
 * Simplified retry for common cases - just retries a few times with linear backoff
 *
 * @example
 * ```typescript
 * const link = await simpleRetry(
 *   () => sendLinksApi.get(linkUrl),
 *   3  // 3 attempts: 0ms, 1000ms, 2000ms
 * )
 * ```
 */
export async function simpleRetry<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    initialDelay: number = 1000
): Promise<T> {
    return retryWithBackoff(fn, {
        maxRetries,
        initialDelay,
        backoffMultiplier: 1, // Linear backoff on frontend
    })
}

/**
 * Calculate exponential backoff delay
 *
 * @param attempt - Current attempt number (0-indexed)
 * @param initialDelay - Initial delay in milliseconds
 * @param multiplier - Backoff multiplier
 * @param maxDelay - Maximum delay cap
 * @param jitter - Add randomness (±25%)
 */
export function calculateBackoff(
    attempt: number,
    initialDelay: number = 1000,
    multiplier: number = 2,
    maxDelay: number = 30000,
    jitter: boolean = false
): number {
    let delay = Math.min(maxDelay, initialDelay * Math.pow(multiplier, attempt))

    if (jitter) {
        const jitterAmount = delay * 0.25
        delay = delay + (Math.random() * 2 - 1) * jitterAmount
    }

    return Math.floor(delay)
}
