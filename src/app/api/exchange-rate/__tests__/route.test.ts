/** @jest-environment node */
import { GET } from '../route'
import { getCachedCurrencyPrice } from '@/app/actions/currency'
import type { NextRequest } from 'next/server'

jest.mock('@/app/actions/currency', () => ({ getCachedCurrencyPrice: jest.fn() }))

const mockGetCachedCurrencyPrice = getCachedCurrencyPrice as jest.Mock

// The route only reads request.nextUrl.searchParams
const get = async (from: string, to: string) => {
    const request = { nextUrl: new URL(`http://localhost/api/exchange-rate?from=${from}&to=${to}`) } as NextRequest
    const response = await GET(request)
    return response.json()
}

describe('GET /api/exchange-rate — display quotes derive from the sell rate in both directions', () => {
    // Provider prices are "currency units per USD": buy = deposit side, sell = withdrawal side
    const EUR = { buy: 0.8699, sell: 0.8614 }
    const BRL = { buy: 5.61, sell: 5.43 }

    beforeEach(() => {
        // Keep the Frankfurter fallback from making live network calls if a
        // regression routes flow past the mocked provider
        global.fetch = jest.fn().mockRejectedValue(new Error('network disabled in tests')) as typeof fetch
        mockGetCachedCurrencyPrice.mockReset()
        mockGetCachedCurrencyPrice.mockImplementation(async (code: string) => {
            if (code === 'EUR') return EUR
            if (code === 'BRL') return BRL
            throw new Error(`unexpected currency ${code}`)
        })
    })

    it('quotes USD→EUR at the sell rate (what a withdrawal delivers)', async () => {
        const { rate } = await get('USD', 'EUR')
        expect(rate).toBeCloseTo(EUR.sell, 10)
    })

    it('quotes EUR→USD off sell too, so both orientations imply the same price', async () => {
        const { rate: usdToEur } = await get('USD', 'EUR')
        const { rate: eurToUsd } = await get('EUR', 'USD')
        expect(eurToUsd).toBeCloseTo(1 / EUR.sell, 10)
        expect(eurToUsd * usdToEur).toBeCloseTo(1, 10)
    })

    it('quotes cross pairs off sell on both legs', async () => {
        const { rate } = await get('EUR', 'BRL')
        expect(rate).toBeCloseTo((1 / EUR.sell) * BRL.sell, 10)
    })

    it('returns 1 for same-currency pairs without hitting providers', async () => {
        const { rate } = await get('EUR', 'EUR')
        expect(rate).toBe(1)
        expect(mockGetCachedCurrencyPrice).not.toHaveBeenCalled()
    })
})
