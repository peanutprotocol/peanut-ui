/** @jest-environment node */
import { GET } from '../route'
import { fetchDisplayRate, FxApiError } from '@/utils/fx.utils'
import type { NextRequest } from 'next/server'

// The shared backend contract is pinned in src/utils/__tests__/fx.utils.test.ts.
// This file only covers compatibility-route validation and response wiring.
jest.mock('@/utils/fx.utils', () => {
    class MockFxApiError extends Error {
        constructor(
            readonly status: number,
            _from?: string,
            _to?: string,
            readonly retryAfter: string | null = null
        ) {
            super(`FX API returned ${status}`)
        }
    }
    return { fetchDisplayRate: jest.fn(), FxApiError: MockFxApiError }
})

const mockFetchDisplayRate = fetchDisplayRate as jest.Mock

// The route only reads request.nextUrl.searchParams
const get = async (query: string) => {
    const request = { nextUrl: new URL(`http://localhost/api/exchange-rate?${query}`) } as NextRequest
    return GET(request)
}

describe('GET /api/exchange-rate — thin wrapper over fetchDisplayRate', () => {
    beforeEach(() => {
        mockFetchDisplayRate.mockReset()
    })

    it('delegates to fetchDisplayRate and returns its rate with CDN cache headers', async () => {
        mockFetchDisplayRate.mockResolvedValue(0.8614)
        const response = await get('from=USD&to=EUR')
        expect(await response.json()).toEqual({ rate: 0.8614 })
        expect(mockFetchDisplayRate).toHaveBeenCalledWith('USD', 'EUR')
        expect(response.headers.get('Cache-Control')).toBe('s-maxage=300')
    })

    it('rejects malformed currency codes with 400 before touching any provider', async () => {
        for (const query of ['from=USD', 'to=EUR', 'from=US%0Ad&to=EUR', 'from=TOOLONG&to=EUR']) {
            const response = await get(query)
            expect(response.status).toBe(400)
            expect(response.headers.get('Cache-Control')).toBe('no-store')
        }
        expect(mockFetchDisplayRate).not.toHaveBeenCalled()
    })

    it('returns 500 when every rate source fails', async () => {
        mockFetchDisplayRate.mockRejectedValue(new Error('all sources down'))
        const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
        const response = await get('from=USD&to=EUR')
        expect(response.status).toBe(500)
        expect(await response.json()).toEqual({ error: 'Failed to fetch exchange rates' })
        expect(response.headers.get('Cache-Control')).toBe('no-store')
        expect(errorSpy).toHaveBeenCalledTimes(1)
        errorSpy.mockRestore()
    })

    it('preserves expected backend pair misses without logging them as server failures', async () => {
        mockFetchDisplayRate.mockRejectedValue(new FxApiError(404, 'ZZZ', 'EUR'))
        const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

        const response = await get('from=ZZZ&to=EUR')

        expect(response.status).toBe(404)
        expect(await response.json()).toEqual({ error: 'Exchange rate unavailable' })
        expect(response.headers.get('Cache-Control')).toBe('no-store')
        expect(errorSpy).not.toHaveBeenCalled()
        errorSpy.mockRestore()
    })

    it.each([503, 429])(
        'preserves upstream %s availability status without logging it as a wrapper failure',
        async (status) => {
            mockFetchDisplayRate.mockRejectedValue(new FxApiError(status, 'PLN', 'EUR', status === 429 ? '30' : null))
            const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

            const response = await get('from=PLN&to=EUR')

            expect(response.status).toBe(status)
            expect(await response.json()).toEqual({ error: 'Exchange rate temporarily unavailable' })
            expect(response.headers.get('Cache-Control')).toBe('no-store')
            expect(response.headers.get('Retry-After')).toBe(status === 429 ? '30' : null)
            expect(errorSpy).not.toHaveBeenCalled()
            errorSpy.mockRestore()
        }
    )
})
