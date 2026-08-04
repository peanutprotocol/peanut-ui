import { displayRateFromPrices, fetchDisplayRate } from '../currency'
import { getCachedCurrencyPrice } from '@/app/actions/currency'

jest.mock('@/app/actions/currency', () => ({ getCachedCurrencyPrice: jest.fn() }))

const mockGetCachedCurrencyPrice = getCachedCurrencyPrice as jest.Mock

// Provider prices are "currency units per USD": buy = deposit side, sell = withdrawal side
const USD = { buy: 1, sell: 1 }
const EUR = { buy: 0.8699, sell: 0.8614 }
const BRL = { buy: 5.61, sell: 5.43 }

describe('displayRateFromPrices — every display orientation derives from the sell rate', () => {
    it('quotes USD→EUR at the sell rate (what a withdrawal delivers)', () => {
        expect(displayRateFromPrices(USD, EUR)).toBeCloseTo(EUR.sell, 10)
    })

    it('quotes EUR→USD off sell too, so both orientations imply the same price', () => {
        expect(displayRateFromPrices(EUR, USD)).toBeCloseTo(1 / EUR.sell, 10)
        expect(displayRateFromPrices(EUR, USD) * displayRateFromPrices(USD, EUR)).toBeCloseTo(1, 10)
    })

    it('quotes cross pairs off sell on both legs', () => {
        expect(displayRateFromPrices(EUR, BRL)).toBeCloseTo((1 / EUR.sell) * BRL.sell, 10)
    })

    it('never reads the buy side', () => {
        expect(displayRateFromPrices({ sell: EUR.sell }, { sell: BRL.sell })).toBe(displayRateFromPrices(EUR, BRL))
    })
})

describe('fetchDisplayRate — provider prices first, Frankfurter fallback', () => {
    beforeEach(() => {
        mockGetCachedCurrencyPrice.mockReset()
        mockGetCachedCurrencyPrice.mockImplementation(async (code: string) => {
            if (code === 'USD') return USD
            if (code === 'EUR') return EUR
            if (code === 'BRL') return BRL
            throw new Error('Invalid currency code')
        })
        global.fetch = jest.fn().mockRejectedValue(new Error('network disabled in tests')) as typeof fetch
    })

    it('returns 1 for same-currency pairs without hitting providers or the network', async () => {
        await expect(fetchDisplayRate('EUR', 'eur')).resolves.toBe(1)
        expect(mockGetCachedCurrencyPrice).not.toHaveBeenCalled()
        expect(global.fetch).not.toHaveBeenCalled()
    })

    it('uppercases inputs and returns the sell-side rate for provider-covered pairs', async () => {
        await expect(fetchDisplayRate('usd', 'eur')).resolves.toBeCloseTo(EUR.sell, 10)
        expect(mockGetCachedCurrencyPrice).toHaveBeenCalledWith('USD')
        expect(mockGetCachedCurrencyPrice).toHaveBeenCalledWith('EUR')
        expect(global.fetch).not.toHaveBeenCalled()
    })

    it('computes cross pairs from both sell sides', async () => {
        await expect(fetchDisplayRate('EUR', 'BRL')).resolves.toBeCloseTo((1 / EUR.sell) * BRL.sell, 10)
    })

    it('falls back to a single Frankfurter call ×0.995 when no provider covers the pair', async () => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ rates: { JPY: 150 } }),
        }) as unknown as typeof fetch
        await expect(fetchDisplayRate('USD', 'JPY')).resolves.toBeCloseTo(150 * 0.995, 10)
        expect(global.fetch).toHaveBeenCalledTimes(1)
    })

    it('falls back when the provider returns an unusable price instead of throwing', async () => {
        mockGetCachedCurrencyPrice.mockResolvedValue({ buy: 0, sell: 0 })
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ rates: { EUR: 0.87 } }),
        }) as unknown as typeof fetch
        await expect(fetchDisplayRate('USD', 'EUR')).resolves.toBeCloseTo(0.87 * 0.995, 10)
    })

    it('rejects when both the providers and Frankfurter fail', async () => {
        mockGetCachedCurrencyPrice.mockRejectedValue(new Error('provider down'))
        global.fetch = jest.fn().mockResolvedValue({ ok: false }) as unknown as typeof fetch
        await expect(fetchDisplayRate('USD', 'EUR')).rejects.toThrow('Failed to fetch exchange rate')
    })

    it('rejects when Frankfurter does not know the requested currency', async () => {
        // e.g. ARS is not ECB-covered: rates object lacks the key → NaN → guard trips
        mockGetCachedCurrencyPrice.mockRejectedValue(new Error('provider down'))
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ rates: {} }),
        }) as unknown as typeof fetch
        await expect(fetchDisplayRate('USD', 'ARS')).rejects.toThrow('Failed to fetch exchange rate')
    })
})
