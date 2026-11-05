/** @jest-environment node */
import { fetchStarLpFxRate, fetchStarLpFxReading, fetchUsdArsRate } from '@/components/Marketing/StarLp/starLpFx'
import { STAR_LP_FX_BACKOFF_MS, starLpFxBackoff } from '@/components/Marketing/StarLp/starLpFxBackoff'
import { serverFetch } from '@/utils/api-fetch'

jest.mock('@/utils/api-fetch', () => ({ serverFetch: jest.fn() }))

// The Data Cache snapshot: a Map stands in for it, with Next's rules that
// matter here. A hit returns the stored value (stale or not) and refreshes it in
// the background; a throw never overwrites it; a miss runs the read and stores
// only a success.
const mockSnapshots = new Map<string, unknown>()
const mockBackgroundReads: Promise<unknown>[] = []
jest.mock('next/cache', () => ({
    unstable_cache:
        (read: (...args: string[]) => Promise<unknown>) =>
        async (...args: string[]) => {
            const key = args.join('|')
            if (mockSnapshots.has(key)) {
                const hit = mockSnapshots.get(key)
                mockBackgroundReads.push(
                    read(...args).then(
                        (fresh) => mockSnapshots.set(key, fresh),
                        () => undefined
                    )
                )
                return hit
            }
            const fresh = await read(...args)
            mockSnapshots.set(key, fresh)
            return fresh
        },
}))

const mockFetch = serverFetch as jest.MockedFunction<typeof serverFetch>
const READ_AT = '2026-10-20T14:30:30.000Z'

const body = (generatedAt = READ_AT, effectiveAt = '2026-10-20T14:30:00.000Z') => ({
    from: 'USD',
    to: 'ARS',
    rate: '1595.7',
    basis: 'display_sell',
    indicative: true,
    selection: 'provider_pair',
    fromSource: 'identity',
    toSource: 'manteca',
    effectiveAt,
    generatedAt,
})

const ok = (json: unknown) => ({ ok: true, status: 200, json: async () => json }) as unknown as Response
const down = () => mockFetch.mockRejectedValue(new TypeError('fetch failed'))
const now = (iso: string) => jest.spyOn(Date, 'now').mockReturnValue(Date.parse(iso))

const quote = {
    from: 'USD',
    to: 'ARS',
    rate: 1595.7,
    source: 'manteca',
    fetchedAt: READ_AT,
    effectiveAt: '2026-10-20T14:30:00.000Z',
}

describe('fetchStarLpFxReading', () => {
    beforeEach(() => {
        mockFetch.mockReset()
        mockSnapshots.clear()
        mockBackgroundReads.length = 0
        starLpFxBackoff.clear()
        now('2026-10-20T14:31:00.000Z')
    })

    afterEach(() => jest.restoreAllMocks())

    it('reads the live rate, its provider and the backend stamps, uncached by fetch', async () => {
        mockFetch.mockResolvedValue(ok(body()))

        await expect(fetchUsdArsRate()).resolves.toEqual({ tier: 'live', quote })
        const [url, init] = mockFetch.mock.calls[0]
        expect(url).toBe('/fx/rate?from=USD&to=ARS')
        expect(init).toMatchObject({ includeAuth: false, timeoutMs: 8000, cache: 'no-store' })
    })

    it('is none when the API is unreachable and nothing was ever read', async () => {
        down()

        await expect(fetchStarLpFxReading('usd', 'ars')).resolves.toEqual({ tier: 'none', quote: null })
        // the failed cold read stored nothing
        expect(mockSnapshots.size).toBe(0)
    })

    it.each([
        ['a 503', { ok: false, status: 503, json: async () => ({ code: 'FX_UNAVAILABLE' }) }],
        ['a broken contract', ok({ ...body(), basis: 'mid' })],
        ['invalid JSON', { ok: true, status: 200, json: async () => Promise.reject(new SyntaxError('x')) }],
    ])('is none on %s', async (_label, response) => {
        mockFetch.mockResolvedValue(response as unknown as Response)

        await expect(fetchUsdArsRate()).resolves.toEqual({ tier: 'none', quote: null })
    })

    it('keeps the last good quote through an outage and prints it as last-known up to 12 hours', async () => {
        mockFetch.mockResolvedValue(ok(body()))
        await fetchUsdArsRate()
        down()

        now('2026-10-20T20:30:00.000Z')
        await expect(fetchUsdArsRate()).resolves.toEqual({ tier: 'lastKnown', quote })
        await Promise.all(mockBackgroundReads)

        now('2026-10-21T02:30:00.000Z')
        await expect(fetchUsdArsRate()).resolves.toEqual({ tier: 'lastKnown', quote })

        now('2026-10-21T02:30:00.001Z')
        await expect(fetchUsdArsRate()).resolves.toEqual({ tier: 'none', quote: null })
    })

    it('reads again in the render when the snapshot is past the live window, so a quiet spell is not an outage', async () => {
        mockFetch.mockResolvedValue(ok(body()))
        await fetchUsdArsRate()

        now('2026-10-20T16:00:00.000Z')
        mockFetch.mockResolvedValue(ok(body('2026-10-20T15:59:58.000Z', '2026-10-20T15:59:57.000Z')))
        const reading = await fetchUsdArsRate()
        expect(reading).toMatchObject({ tier: 'live', quote: { fetchedAt: '2026-10-20T15:59:58.000Z' } })
        // the render's own read has the short budget
        expect(mockFetch.mock.calls.at(-1)?.[1]).toMatchObject({ timeoutMs: 2000 })
    })
})

describe('fetchStarLpFxReading during an outage', () => {
    beforeEach(() => {
        mockFetch.mockReset()
        mockSnapshots.clear()
        mockBackgroundReads.length = 0
        starLpFxBackoff.clear()
        now('2026-10-20T14:31:00.000Z')
    })

    afterEach(() => jest.restoreAllMocks())

    it('waits on a dead API once a minute with no snapshot, not on every render', async () => {
        down()
        await expect(fetchUsdArsRate()).resolves.toEqual({ tier: 'none', quote: null })
        await expect(fetchUsdArsRate()).resolves.toEqual({ tier: 'none', quote: null })
        expect(mockFetch).toHaveBeenCalledTimes(1)

        now(new Date(Date.parse('2026-10-20T14:31:00.000Z') + STAR_LP_FX_BACKOFF_MS).toISOString())
        mockFetch.mockResolvedValue(ok(body()))
        await expect(fetchUsdArsRate()).resolves.toMatchObject({ tier: 'live' })
    })

    it('keeps printing the old snapshot without a direct read for a minute after one fails', async () => {
        mockFetch.mockResolvedValue(ok(body()))
        await fetchUsdArsRate()
        down()

        now('2026-10-20T16:00:00.000Z')
        await expect(fetchUsdArsRate()).resolves.toEqual({ tier: 'lastKnown', quote })
        await Promise.all(mockBackgroundReads)
        const reads = mockFetch.mock.calls.length
        await expect(fetchUsdArsRate()).resolves.toEqual({ tier: 'lastKnown', quote })
        await Promise.all(mockBackgroundReads)
        // only the cache's own background refresh ran, no direct read in the render
        expect(mockFetch.mock.calls.slice(reads).every(([, init]) => init?.timeoutMs === 8000)).toBe(true)
    })
})

describe('fetchStarLpFxRate (Brazil, US/EU)', () => {
    beforeEach(() => {
        mockFetch.mockReset()
        mockSnapshots.clear()
        starLpFxBackoff.clear()
        now('2026-10-20T14:31:00.000Z')
    })

    afterEach(() => jest.restoreAllMocks())

    it('returns only a live rate, never a last-known one', async () => {
        mockFetch.mockResolvedValue(ok(body()))
        await expect(fetchStarLpFxRate('USD', 'ARS')).resolves.toEqual(quote)
        down()

        now('2026-10-20T15:05:00.000Z')
        await expect(fetchStarLpFxRate('USD', 'ARS')).resolves.toBeNull()
    })

    it('reads EUR→USD from the Bridge leg', async () => {
        mockFetch.mockResolvedValue(
            ok({ ...body(), from: 'EUR', to: 'USD', rate: '1.1171', fromSource: 'bridge', toSource: 'identity' })
        )

        await expect(fetchStarLpFxRate('EUR', 'USD')).resolves.toMatchObject({
            from: 'EUR',
            to: 'USD',
            source: 'bridge',
        })
    })
})
