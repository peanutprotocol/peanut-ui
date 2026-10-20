/** @jest-environment node */
import { fetchStarLpFxRate, fetchUsdArsRate } from '@/components/Marketing/StarLp/starLpFx'
import { serverFetch } from '@/utils/api-fetch'

jest.mock('@/utils/api-fetch', () => ({ serverFetch: jest.fn() }))

const NOW = Date.parse('2026-10-20T14:31:00.000Z')

const usdArs = {
    from: 'USD',
    to: 'ARS',
    rate: '1595.7',
    basis: 'display_sell',
    indicative: true,
    selection: 'provider_pair',
    fromSource: 'identity',
    toSource: 'manteca',
    effectiveAt: '2026-10-20T14:30:00.000Z',
    generatedAt: '2026-10-20T14:30:30.000Z',
}

const mockFetch = serverFetch as jest.MockedFunction<typeof serverFetch>

describe('fetchStarLpFxRate', () => {
    beforeEach(() => {
        mockFetch.mockReset()
        jest.spyOn(Date, 'now').mockReturnValue(NOW)
    })

    afterEach(() => jest.restoreAllMocks())

    it('returns the live rate, its provider and when the backend made it', async () => {
        mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => usdArs } as unknown as Response)

        await expect(fetchUsdArsRate()).resolves.toEqual({
            from: 'USD',
            to: 'ARS',
            rate: 1595.7,
            source: 'manteca',
            fetchedAt: '2026-10-20T14:30:30.000Z',
        })
        const [url, init] = mockFetch.mock.calls[0]
        expect(url).toBe('/fx/rate?from=USD&to=ARS')
        expect(init).toMatchObject({ includeAuth: false, timeoutMs: 8000, next: { revalidate: 300 } })
    })

    it('returns null when the API is unreachable, so the page hides the converted line', async () => {
        mockFetch.mockRejectedValue(new TypeError('fetch failed'))

        await expect(fetchStarLpFxRate('usd', 'brl')).resolves.toBeNull()
    })

    it.each([
        ['a 503', { ok: false, status: 503, json: async () => ({ code: 'FX_UNAVAILABLE' }) }],
        ['a broken contract', { ok: true, status: 200, json: async () => ({ ...usdArs, basis: 'mid' }) }],
        ['invalid JSON', { ok: true, status: 200, json: async () => Promise.reject(new SyntaxError('x')) }],
    ])('returns null on %s', async (_label, response) => {
        mockFetch.mockResolvedValue(response as unknown as Response)

        await expect(fetchUsdArsRate()).resolves.toBeNull()
    })

    it('returns null for a cached rate older than 30 minutes', async () => {
        jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-20T15:05:00.000Z'))
        mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => usdArs } as unknown as Response)

        await expect(fetchUsdArsRate()).resolves.toBeNull()
    })
})
