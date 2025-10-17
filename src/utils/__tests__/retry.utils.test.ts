/**
 * Unit tests for retry utilities (frontend)
 */

import { retryWithBackoff, simpleRetry, calculateBackoff } from '../retry.utils'

describe('retry.utils', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    describe('retryWithBackoff', () => {
        it('should succeed on first attempt', async () => {
            const fn = jest.fn(async () => 'success')

            const result = await retryWithBackoff(fn, { maxRetries: 3 })

            expect(result).toBe('success')
            expect(fn).toHaveBeenCalledTimes(1)
        })

        it('should retry on failure and eventually succeed', async () => {
            let attempts = 0
            const fn = jest.fn(async () => {
                attempts++
                if (attempts < 3) {
                    throw new Error('Temporary failure')
                }
                return 'success'
            })

            const result = await retryWithBackoff(fn, { maxRetries: 3, initialDelay: 10 })

            expect(result).toBe('success')
            expect(fn).toHaveBeenCalledTimes(3)
        })

        it('should throw after max retries exhausted', async () => {
            const fn = jest.fn(async () => {
                throw new Error('Permanent failure')
            })

            await expect(retryWithBackoff(fn, { maxRetries: 3, initialDelay: 10 })).rejects.toThrow('Permanent failure')

            expect(fn).toHaveBeenCalledTimes(3)
        })

        it('should call onRetry callback on each retry', async () => {
            let attempts = 0
            const fn = jest.fn(async () => {
                attempts++
                if (attempts < 3) throw new Error('Fail')
                return 'success'
            })
            const onRetry = jest.fn()

            await retryWithBackoff(fn, { maxRetries: 3, initialDelay: 10, onRetry })

            expect(onRetry).toHaveBeenCalledTimes(2)
            expect(onRetry).toHaveBeenNthCalledWith(1, 1, expect.any(Error), expect.any(Number))
            expect(onRetry).toHaveBeenNthCalledWith(2, 2, expect.any(Error), expect.any(Number))
        })

        it('should respect shouldRetry predicate', async () => {
            const fn = jest.fn(async () => {
                throw new Error('Network offline')
            })

            await expect(
                retryWithBackoff(fn, {
                    maxRetries: 3,
                    shouldRetry: (error) => !error.message.includes('offline'),
                })
            ).rejects.toThrow('Network offline')

            expect(fn).toHaveBeenCalledTimes(1)
        })

        it('should use linear backoff by default (multiplier 1)', async () => {
            let attempts = 0
            const fn = jest.fn(async () => {
                attempts++
                if (attempts < 3) throw new Error('Fail')
                return 'success'
            })
            const delays: number[] = []
            const onRetry = jest.fn((attempt, error, delay) => {
                delays.push(delay)
            })

            await retryWithBackoff(fn, {
                maxRetries: 3,
                initialDelay: 1000,
                backoffMultiplier: 1, // Linear
                onRetry,
            })

            // Linear: 1000, 1000 (same delay each time)
            expect(delays[0]).toBe(1000)
            expect(delays[1]).toBe(1000)
        })

        it('should support exponential backoff when configured', async () => {
            let attempts = 0
            const fn = jest.fn(async () => {
                attempts++
                if (attempts < 3) throw new Error('Fail')
                return 'success'
            })
            const delays: number[] = []
            const onRetry = jest.fn((attempt, error, delay) => {
                delays.push(delay)
            })

            await retryWithBackoff(fn, {
                maxRetries: 3,
                initialDelay: 100,
                backoffMultiplier: 2,
                onRetry,
            })

            // Exponential: 100, 200
            expect(delays[0]).toBe(100)
            expect(delays[1]).toBe(200)
        })

        it('should respect maxDelay cap', async () => {
            let attempts = 0
            const fn = jest.fn(async () => {
                attempts++
                if (attempts < 4) throw new Error('Fail')
                return 'success'
            })
            const delays: number[] = []
            const onRetry = jest.fn((attempt, error, delay) => {
                delays.push(delay)
            })

            await retryWithBackoff(fn, {
                maxRetries: 4,
                initialDelay: 100,
                backoffMultiplier: 10,
                maxDelay: 300,
                onRetry,
            })

            // Without cap: 100, 1000, 10000
            // With cap: 100, 300, 300
            expect(delays[0]).toBe(100)
            expect(delays[1]).toBe(300) // Capped
            expect(delays[2]).toBe(300) // Capped
        })

        it('should apply jitter when enabled', async () => {
            let attempts = 0
            const fn = jest.fn(async () => {
                attempts++
                if (attempts < 3) throw new Error('Fail')
                return 'success'
            })
            const delays: number[] = []
            const onRetry = jest.fn((attempt, error, delay) => {
                delays.push(delay)
            })

            await retryWithBackoff(fn, {
                maxRetries: 3,
                initialDelay: 1000,
                backoffMultiplier: 1,
                jitter: true,
                onRetry,
            })

            // With jitter, delays should vary within ±25%
            // Expected: 1000, 1000
            // Range: 750-1250
            expect(delays[0]).toBeGreaterThanOrEqual(750)
            expect(delays[0]).toBeLessThanOrEqual(1250)
            expect(delays[1]).toBeGreaterThanOrEqual(750)
            expect(delays[1]).toBeLessThanOrEqual(1250)
        })
    })

    describe('simpleRetry', () => {
        it('should be a simplified wrapper', async () => {
            const fn = jest.fn(async () => 'success')

            const result = await simpleRetry(fn, 3, 10)

            expect(result).toBe('success')
            expect(fn).toHaveBeenCalledTimes(1)
        })

        it('should retry with default parameters', async () => {
            let attempts = 0
            const fn = jest.fn(async () => {
                attempts++
                if (attempts < 2) throw new Error('Fail')
                return 'success'
            })

            const result = await simpleRetry(fn)

            expect(result).toBe('success')
            expect(fn).toHaveBeenCalledTimes(2)
        })
    })

    describe('calculateBackoff', () => {
        it('should calculate backoff correctly', () => {
            expect(calculateBackoff(0, 1000, 2)).toBe(1000) // 1000 * 2^0 = 1000
            expect(calculateBackoff(1, 1000, 2)).toBe(2000) // 1000 * 2^1 = 2000
            expect(calculateBackoff(2, 1000, 2)).toBe(4000) // 1000 * 2^2 = 4000
        })

        it('should calculate linear backoff', () => {
            expect(calculateBackoff(0, 1000, 1)).toBe(1000)
            expect(calculateBackoff(1, 1000, 1)).toBe(1000)
            expect(calculateBackoff(2, 1000, 1)).toBe(1000)
        })

        it('should respect max delay cap', () => {
            expect(calculateBackoff(10, 1000, 2, 5000)).toBe(5000) // Would be huge, capped at 5000
        })

        it('should apply jitter when enabled', () => {
            const delays = Array.from({ length: 10 }, () => calculateBackoff(0, 1000, 1, 30000, true))

            // All delays should be within ±25% of 1000
            delays.forEach((delay) => {
                expect(delay).toBeGreaterThanOrEqual(750)
                expect(delay).toBeLessThanOrEqual(1250)
            })

            // Should have variety
            const uniqueDelays = new Set(delays)
            expect(uniqueDelays.size).toBeGreaterThan(1)
        })
    })

    describe('real-world scenarios', () => {
        it('should handle fresh link loading (like checkLink)', async () => {
            let attempts = 0
            const mockGetLink = jest.fn(async () => {
                attempts++
                // Simulate link not found for first 2 attempts (RPC sync lag)
                if (attempts < 3) {
                    throw new Error('Link not found')
                }
                return {
                    pubKey: '0x123',
                    status: 'completed',
                    chainId: '137',
                    tokenAddress: '0xabc',
                }
            })

            const result = await retryWithBackoff(mockGetLink, {
                maxRetries: 3,
                initialDelay: 10,
                backoffMultiplier: 1,
            })

            expect(result).toEqual({
                pubKey: '0x123',
                status: 'completed',
                chainId: '137',
                tokenAddress: '0xabc',
            })
            expect(mockGetLink).toHaveBeenCalledTimes(3)
        })

        it('should handle API failures with logging', async () => {
            let attempts = 0
            const mockApi = jest.fn(async () => {
                attempts++
                if (attempts < 2) {
                    throw new Error('Temporary network issue')
                }
                return { data: 'success' }
            })

            const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

            const result = await retryWithBackoff(mockApi, {
                maxRetries: 3,
                initialDelay: 10,
                onRetry: (attempt, error, delay) => {
                    console.log(`Retry ${attempt}/3 - ${error.message}`)
                },
            })

            expect(result).toEqual({ data: 'success' })
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Retry 1/3'))

            consoleSpy.mockRestore()
        })

        it('should not retry on validation errors', async () => {
            const mockApi = jest.fn(async () => {
                throw new Error('Invalid input')
            })

            await expect(
                retryWithBackoff(mockApi, {
                    maxRetries: 3,
                    shouldRetry: (error) => !error.message.includes('Invalid'),
                })
            ).rejects.toThrow('Invalid input')

            expect(mockApi).toHaveBeenCalledTimes(1)
        })
    })
})
