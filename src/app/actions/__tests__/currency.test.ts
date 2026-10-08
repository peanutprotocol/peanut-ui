/**
 * Tests for getCurrencyPrice (live) and getCachedCurrencyPrice (60s TTL).
 *
 * The cache shim in @/utils/no-cache is module-scoped, so we jest.resetModules()
 * between tests and re-require the SUT to start each test with a cold cache.
 */

import { AccountType } from '@/interfaces/interfaces'

const mantecaGetPrices = jest.fn()
const getExchangeRateMock = jest.fn()

jest.mock('@/services/manteca', () => ({
    mantecaApi: { getPrices: (...args: unknown[]) => mantecaGetPrices(...args) },
}))
jest.mock('../exchange-rate', () => ({
    getExchangeRate: (...args: unknown[]) => getExchangeRateMock(...args),
}))

type ScopeSpy = { setFingerprint: jest.Mock; setTag: jest.Mock }
const scopes: ScopeSpy[] = []
const captureException = jest.fn()
jest.mock('@/utils/sentry-lazy', () => ({
    withScope: (callback: (scope: ScopeSpy) => void) => {
        const scope = { setFingerprint: jest.fn(), setTag: jest.fn() }
        scopes.push(scope)
        callback(scope)
    },
    captureException: (...args: unknown[]) => captureException(...args),
}))

const reportedTags = (index = 0) => Object.fromEntries(scopes[index].setTag.mock.calls)
const reportedFingerprint = (index = 0) => scopes[index].setFingerprint.mock.calls[0][0]

type CurrencyModule = typeof import('../currency')

const loadModule = (): CurrencyModule => {
    let mod!: CurrencyModule
    jest.isolateModules(() => {
        mod = require('../currency')
    })
    return mod
}

beforeEach(() => {
    mantecaGetPrices.mockReset()
    getExchangeRateMock.mockReset()
    captureException.mockReset()
    scopes.length = 0
    jest.useRealTimers()
})

describe('getCurrencyPrice (uncached, commit-path)', () => {
    it('returns 1:1 for USD without calling any provider', async () => {
        const { getCurrencyPrice } = loadModule()
        await expect(getCurrencyPrice('USD')).resolves.toEqual({ buy: 1, sell: 1 })
        expect(mantecaGetPrices).not.toHaveBeenCalled()
        expect(getExchangeRateMock).not.toHaveBeenCalled()
    })

    it('normalizes lowercase currency codes to uppercase', async () => {
        mantecaGetPrices.mockResolvedValue({ effectiveBuy: '1200', effectiveSell: '1180' })
        const { getCurrencyPrice } = loadModule()
        await getCurrencyPrice('ars')
        expect(mantecaGetPrices).toHaveBeenCalledWith(
            { asset: 'USDC', against: 'ARS' },
            { callerReportsFailures: true }
        )
    })

    it('routes EUR through Bridge with IBAN account type', async () => {
        getExchangeRateMock.mockResolvedValue({ data: { buy_rate: '0.92', sell_rate: '0.90' }, error: null })
        const { getCurrencyPrice } = loadModule()
        await expect(getCurrencyPrice('EUR')).resolves.toEqual({ buy: 0.92, sell: 0.9 })
        expect(getExchangeRateMock).toHaveBeenCalledWith(AccountType.IBAN, { callerReportsFailures: true })
        expect(captureException).not.toHaveBeenCalled()
    })

    it('routes Manteca currencies through mantecaApi.getPrices', async () => {
        mantecaGetPrices.mockResolvedValue({ effectiveBuy: '1200', effectiveSell: '1180' })
        const { getCurrencyPrice } = loadModule()
        await expect(getCurrencyPrice('ARS')).resolves.toEqual({ buy: 1200, sell: 1180 })
    })

    it('reads the current Manteca shape where the effective rate is nested under effectivePrice', async () => {
        // Manteca moved effectiveBuy/effectiveSell under effectivePrice on 2026-07-01;
        // reading the old top-level fields yielded NaN → "Invalid buy rate from provider".
        mantecaGetPrices.mockResolvedValue({
            buy: '1596.90',
            sell: '1541.96',
            effectivePrice: { buy: '1596.900', sell: '1541.960' },
        })
        const { getCurrencyPrice } = loadModule()
        await expect(getCurrencyPrice('ARS')).resolves.toEqual({ buy: 1596.9, sell: 1541.96 })
    })

    it('prefers effectivePrice over the legacy top-level fields when both are present', async () => {
        mantecaGetPrices.mockResolvedValue({
            effectiveBuy: '1',
            effectiveSell: '1',
            effectivePrice: { buy: '1200', sell: '1180' },
        })
        const { getCurrencyPrice } = loadModule()
        await expect(getCurrencyPrice('ARS')).resolves.toEqual({ buy: 1200, sell: 1180 })
    })

    it('throws on unknown currency code', async () => {
        const { getCurrencyPrice } = loadModule()
        await expect(getCurrencyPrice('XYZ')).rejects.toThrow('Invalid currency code')
    })

    it('throws when Bridge returns an error', async () => {
        getExchangeRateMock.mockResolvedValue({ data: null, error: 'down', status: 502, failure: 'http' })
        const { getCurrencyPrice } = loadModule()
        await expect(getCurrencyPrice('EUR')).rejects.toMatchObject({
            name: 'FxRateUnavailableError',
            provider: 'bridge',
            currency: 'EUR',
            failure: 'http',
            status: 502,
        })
    })

    it('throws when Manteca returns a non-numeric rate (NaN)', async () => {
        mantecaGetPrices.mockResolvedValue({ effectiveBuy: 'not-a-number', effectiveSell: '1180' })
        const { getCurrencyPrice } = loadModule()
        await expect(getCurrencyPrice('ARS')).rejects.toMatchObject({ failure: 'invalid_rate' })
    })

    it('throws when Manteca returns a zero rate', async () => {
        mantecaGetPrices.mockResolvedValue({ effectiveBuy: '0', effectiveSell: '1180' })
        const { getCurrencyPrice } = loadModule()
        await expect(getCurrencyPrice('ARS')).rejects.toMatchObject({ failure: 'invalid_rate' })
    })

    it('throws when Bridge returns a negative rate', async () => {
        getExchangeRateMock.mockResolvedValue({ data: { buy_rate: '-0.5', sell_rate: '0.9' }, error: null })
        const { getCurrencyPrice } = loadModule()
        await expect(getCurrencyPrice('EUR')).rejects.toMatchObject({ provider: 'bridge', failure: 'invalid_rate' })
    })

    it('does not report an unsupported currency as a provider failure', async () => {
        const { getCurrencyPrice } = loadModule()
        await expect(getCurrencyPrice('XYZ')).rejects.toThrow('Invalid currency code')
        expect(captureException).not.toHaveBeenCalled()
    })

    it('reports each live quote failure once, with no cached fallback', async () => {
        getExchangeRateMock
            .mockResolvedValueOnce({ error: 'timed out', failure: 'timeout' })
            .mockResolvedValueOnce({ error: 'timed out', failure: 'timeout' })
            .mockResolvedValueOnce({ data: { buy_rate: '0.92', sell_rate: '0.90' } })
        const { getCurrencyPrice } = loadModule()

        await expect(getCurrencyPrice('EUR')).rejects.toMatchObject({ failure: 'timeout' })
        await expect(getCurrencyPrice('EUR')).rejects.toMatchObject({ failure: 'timeout' })
        await expect(getCurrencyPrice('EUR')).resolves.toEqual({ buy: 0.92, sell: 0.9 })

        expect(getExchangeRateMock).toHaveBeenCalledTimes(3)
        expect(captureException).toHaveBeenCalledTimes(2)
        expect(reportedFingerprint()).toEqual(['fx-rate-unavailable', 'bridge', 'timeout'])
        expect(captureException.mock.calls[0][1]).toEqual({ level: 'warning' })
    })

    it('classifies a Manteca HTTP failure by status and a transport failure by its wrapper', async () => {
        mantecaGetPrices
            .mockRejectedValueOnce(Object.assign(new Error('Get prices failed'), { status: 503 }))
            .mockRejectedValueOnce(
                Object.assign(new Error('Peanut is taking too long'), { name: 'ConnectionTimeoutError' })
            )
            .mockRejectedValueOnce(
                Object.assign(new Error('Something went wrong'), { name: 'ServiceUnavailableError' })
            )
        const { getCurrencyPrice } = loadModule()

        await expect(getCurrencyPrice('ARS')).rejects.toMatchObject({ failure: 'http', status: 503 })
        await expect(getCurrencyPrice('ARS')).rejects.toMatchObject({ failure: 'timeout' })
        await expect(getCurrencyPrice('ARS')).rejects.toMatchObject({ failure: 'network' })

        expect(reportedTags(0)).toEqual({
            'fx.provider': 'manteca',
            'fx.currency': 'ARS',
            'fx.failure': 'http',
            'http.status_code': '503',
        })
        expect(captureException.mock.calls[0][1]).toEqual({ level: 'error' })
    })

    it('hits the provider on every call (no caching on the commit path)', async () => {
        mantecaGetPrices.mockResolvedValue({ effectiveBuy: '1200', effectiveSell: '1180' })
        const { getCurrencyPrice } = loadModule()
        await getCurrencyPrice('ARS')
        await getCurrencyPrice('ARS')
        await getCurrencyPrice('ARS')
        expect(mantecaGetPrices).toHaveBeenCalledTimes(3)
    })
})

describe('getCachedCurrencyPrice (60s TTL, display path)', () => {
    it('hits the provider once within the TTL window', async () => {
        mantecaGetPrices.mockResolvedValue({ effectiveBuy: '1200', effectiveSell: '1180' })
        const { getCachedCurrencyPrice } = loadModule()
        const first = await getCachedCurrencyPrice('ARS')
        const second = await getCachedCurrencyPrice('ARS')
        expect(first).toEqual({ buy: 1200, sell: 1180 })
        expect(second).toEqual({ buy: 1200, sell: 1180 })
        expect(mantecaGetPrices).toHaveBeenCalledTimes(1)
    })

    it('treats normalized codes as the same cache key', async () => {
        mantecaGetPrices.mockResolvedValue({ effectiveBuy: '1200', effectiveSell: '1180' })
        const { getCachedCurrencyPrice } = loadModule()
        await getCachedCurrencyPrice('ars')
        await getCachedCurrencyPrice('ARS')
        await getCachedCurrencyPrice('Ars')
        expect(mantecaGetPrices).toHaveBeenCalledTimes(1)
    })

    it('refetches after the 60s TTL expires', async () => {
        jest.useFakeTimers({ now: 0 })
        mantecaGetPrices
            .mockResolvedValueOnce({ effectiveBuy: '1200', effectiveSell: '1180' })
            .mockResolvedValueOnce({ effectiveBuy: '1300', effectiveSell: '1280' })
        const { getCachedCurrencyPrice } = loadModule()

        const first = await getCachedCurrencyPrice('ARS')
        jest.setSystemTime(61_000) // past 60s TTL
        const second = await getCachedCurrencyPrice('ARS')

        expect(first).toEqual({ buy: 1200, sell: 1180 })
        expect(second).toEqual({ buy: 1300, sell: 1280 })
        expect(mantecaGetPrices).toHaveBeenCalledTimes(2)
    })

    it('does NOT cache thrown errors — next call retries the provider', async () => {
        mantecaGetPrices
            .mockRejectedValueOnce(new Error('provider blip'))
            .mockResolvedValueOnce({ effectiveBuy: '1200', effectiveSell: '1180' })
        const { getCachedCurrencyPrice } = loadModule()

        await expect(getCachedCurrencyPrice('ARS')).rejects.toMatchObject({ name: 'FxRateUnavailableError' })
        await expect(getCachedCurrencyPrice('ARS')).resolves.toEqual({ buy: 1200, sell: 1180 })
        expect(mantecaGetPrices).toHaveBeenCalledTimes(2)
    })

    it('concurrent display consumers share one failed provider request and one report', async () => {
        let respond!: (value: unknown) => void
        getExchangeRateMock.mockReturnValueOnce(new Promise((resolve) => (respond = resolve)))
        const { getCachedCurrencyPrice } = loadModule()

        const consumers = [getCachedCurrencyPrice('EUR'), getCachedCurrencyPrice('eur'), getCachedCurrencyPrice('EUR')]
        respond({ error: 'Failed to fetch exchange rate.', status: 503, failure: 'http' })
        const outcomes = await Promise.allSettled(consumers)

        const reasons = outcomes.map((outcome) => (outcome as PromiseRejectedResult).reason)
        expect(new Set(reasons).size).toBe(1)
        expect(reasons[0]).toMatchObject({ name: 'FxRateUnavailableError', failure: 'http', status: 503 })
        expect(getExchangeRateMock).toHaveBeenCalledTimes(1)
        expect(captureException).toHaveBeenCalledTimes(1)
        expect(captureException.mock.calls[0][0]).toBe(reasons[0])
        expect(reportedTags()).toEqual({
            'fx.provider': 'bridge',
            'fx.currency': 'EUR',
            'fx.failure': 'http',
            'http.status_code': '503',
        })
    })

    it('files a report the Sentry and PostHog filters keep', async () => {
        getExchangeRateMock.mockResolvedValueOnce({ error: 'Failed to fetch', failure: 'network' })
        const { getCachedCurrencyPrice } = loadModule()
        const error = (await getCachedCurrencyPrice('MXN').catch((reason: unknown) => reason)) as Error

        const { shouldIgnoreError } = jest.requireActual('../../../../sentry.utils')
        const { isExpectedExceptionChain } = jest.requireActual('@/utils/expected-exception')
        const exceptions = [{ type: error.name, value: error.message }]
        expect(error.cause).toBeUndefined()
        expect(isExpectedExceptionChain(exceptions)).toBe(false)
        expect(
            shouldIgnoreError({
                type: undefined,
                exception: { values: exceptions },
                fingerprint: reportedFingerprint(),
                tags: reportedTags(),
            })
        ).toBe(false)
    })

    it('does NOT cache invalid rates (NaN) — they throw, next call retries', async () => {
        mantecaGetPrices
            .mockResolvedValueOnce({ effectiveBuy: 'garbage', effectiveSell: '1180' })
            .mockResolvedValueOnce({ effectiveBuy: '1200', effectiveSell: '1180' })
        const { getCachedCurrencyPrice } = loadModule()

        await expect(getCachedCurrencyPrice('ARS')).rejects.toMatchObject({ failure: 'invalid_rate' })
        await expect(getCachedCurrencyPrice('ARS')).resolves.toEqual({ buy: 1200, sell: 1180 })
        expect(mantecaGetPrices).toHaveBeenCalledTimes(2)
    })

    it('serves USD from cache without hitting providers', async () => {
        const { getCachedCurrencyPrice } = loadModule()
        await expect(getCachedCurrencyPrice('USD')).resolves.toEqual({ buy: 1, sell: 1 })
        expect(mantecaGetPrices).not.toHaveBeenCalled()
        expect(getExchangeRateMock).not.toHaveBeenCalled()
    })
})
