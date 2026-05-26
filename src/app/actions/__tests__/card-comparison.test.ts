import { getCardMarkupRate } from '@/app/actions/card-comparison'

jest.mock('@/app/actions/currency', () => ({
    getCurrencyPrice: jest.fn(),
}))

const { getCurrencyPrice } = jest.requireMock('@/app/actions/currency')

describe('getCardMarkupRate', () => {
    const originalFetch = global.fetch

    beforeEach(() => {
        jest.clearAllMocks()
        global.fetch = jest.fn() as any
    })

    afterAll(() => {
        global.fetch = originalFetch
    })

    it('returns null for currencies outside the comparison set', async () => {
        const result = await getCardMarkupRate('EUR', 1.05)
        expect(result).toBeNull()
    })

    it('returns null for empty currency code', async () => {
        const result = await getCardMarkupRate('', 100)
        expect(result).toBeNull()
    })

    it('returns the static BRL rate without hitting the network', async () => {
        const result = await getCardMarkupRate('BRL')
        expect(result).toEqual({ rate: 0.07, source: 'static' })
        expect(global.fetch).not.toHaveBeenCalled()
        expect(getCurrencyPrice).not.toHaveBeenCalled()
    })

    it('returns a live ARS rate when both dolarapi and a Manteca price are available', async () => {
        ;(global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({ venta: 1000 }),
        })
        // mantecaPrice=1100, bcra=1000, issuer=0.03
        // effectiveCardRate = 1000 * 0.97 = 970
        // rate = 1100/970 - 1 ≈ 0.1340
        const result = await getCardMarkupRate('ARS', 1100)
        expect(result?.source).toBe('live')
        expect(result?.rate).toBeCloseTo(0.134, 3)
    })

    it('fetches Manteca itself when no price is passed (LocalRailNudge call shape)', async () => {
        getCurrencyPrice.mockResolvedValueOnce({ sell: 1100, buy: 1080 })
        ;(global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({ venta: 1000 }),
        })
        const result = await getCardMarkupRate('ARS')
        expect(getCurrencyPrice).toHaveBeenCalledWith('ARS')
        expect(result?.source).toBe('live')
        expect(result?.rate).toBeGreaterThan(0)
    })

    it('falls back to the static ARS rate when dolarapi fails', async () => {
        ;(global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: false,
            status: 503,
            json: () => Promise.resolve({}),
        })
        const result = await getCardMarkupRate('ARS', 1100)
        expect(result).toEqual({ rate: 0.0913, source: 'static' })
    })

    it('falls back to the static ARS rate when dolarapi throws', async () => {
        ;(global.fetch as jest.Mock).mockRejectedValueOnce(new Error('network down'))
        const result = await getCardMarkupRate('ARS', 1100)
        expect(result).toEqual({ rate: 0.0913, source: 'static' })
    })

    it('falls back to the static ARS rate when dolarapi returns garbage', async () => {
        ;(global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({ venta: 'not-a-number' }),
        })
        const result = await getCardMarkupRate('ARS', 1100)
        expect(result).toEqual({ rate: 0.0913, source: 'static' })
    })

    it('falls back to static when the live calc produces a non-positive markup (manteca cheaper than BCRA)', async () => {
        // Pathological case — BCRA above Manteca should never happen, but we
        // guard against showing "-3% savings" if FX weirdness inverts it.
        ;(global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({ venta: 2000 }),
        })
        const result = await getCardMarkupRate('ARS', 1100)
        expect(result).toEqual({ rate: 0.0913, source: 'static' })
    })

    it('normalizes the currency code (lower-case input)', async () => {
        const result = await getCardMarkupRate('brl')
        expect(result).toEqual({ rate: 0.07, source: 'static' })
    })
})
