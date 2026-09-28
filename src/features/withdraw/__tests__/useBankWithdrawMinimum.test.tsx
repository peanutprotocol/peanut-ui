/**
 * The Bridge bank minimum Rates & fees shows, through the REAL offramp quote
 * hook and a shared QueryClient with only the network mocked — so a mocked
 * final rate cannot hide a fallback again. The withdraw flows compare the same
 * payout minimum in the bank's currency, at the same quote; this is it in USD,
 * up to the cent.
 */
import { act, renderHook, waitFor } from '@testing-library/react'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AccountType } from '@/interfaces/interfaces'
import { useBankWithdrawMinimum } from '../useBankWithdrawMinimum'

// the withdrawal's own rate: GET /bridge/offramp/quote (30 s refresh)
const getOfframpQuoteMock = jest.fn()
jest.mock('@/app/actions/offramp', () => ({
    getOfframpQuote: (...args: unknown[]) => getOfframpQuoteMock(...args),
}))
// the longer-cached display rate (GET /bridge/exchange-rate): must not decide the minimum
const getExchangeRateMock = jest.fn()
jest.mock('@/app/actions/exchange-rate', () => ({
    getExchangeRate: (...args: unknown[]) => getExchangeRateMock(...args),
}))

const makeClient = () => new QueryClient({ defaultOptions: { queries: { gcTime: 0, staleTime: 0 } } })

const renderGate = (countryIso2: string, client = makeClient(), enabled = true) => {
    const wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(QueryClientProvider, { client }, children)
    const hook = renderHook(
        ({ iso2, on }: { iso2: string; on: boolean }) => useBankWithdrawMinimum(iso2, { enabled: on }),
        { wrapper, initialProps: { iso2: countryIso2, on: enabled } }
    )
    return { ...hook, client }
}

/**
 * Quote replies by bank currency; a missing currency is an API error. A reply
 * names its currency, as the API does: the quote hook refuses any other.
 */
const bridgeQuote = (rates: Record<string, string | { error: string }>) =>
    getOfframpQuoteMock.mockImplementation(async (currency: string) => {
        const rate = rates[currency]
        if (rate === undefined) return { error: 'no quote' }
        return typeof rate === 'string' ? { data: { destinationCurrency: currency, rate } } : rate
    })

// the quote hook retries twice (1 s, then 2 s) before it reports an error
const QUOTE_ERROR_WAIT = { timeout: 6000 }

beforeEach(() => {
    getOfframpQuoteMock.mockReset()
    getExchangeRateMock.mockReset()
})

describe('useBankWithdrawMinimum', () => {
    // $2.95 × 17 = 50.15 MXN reaches 50; $2.94 × 17 = 49.98 does not. A
    // whole-dollar ceiling asked $3 (51 MXN) for a 50 MXN minimum.
    it('MX at quote 17: $2.95, the cent that reaches 50 MXN', async () => {
        bridgeQuote({ mxn: '17' })
        const { result, client } = renderGate('MX')
        await waitFor(() => expect(result.current).toEqual({ minUsd: 2.95, status: 'ready' }))
        // the rate alone: no destination amount
        expect(getOfframpQuoteMock).toHaveBeenCalledWith('mxn', undefined)
        client.clear()
    })

    it('MX at quote 16.5: $3.04', async () => {
        bridgeQuote({ mxn: '16.5' })
        const { result, client } = renderGate('MX')
        await waitFor(() => expect(result.current).toEqual({ minUsd: 3.04, status: 'ready' }))
        client.clear()
    })

    /*
     * Chip 5342603409: the minimum came from the display rate, cached for five
     * minutes, while the withdrawal converts at the 30-second quote. A cached 17
     * allowed $2.95 where the current 16.5 needs $3.04.
     */
    it('a stale cached display rate never sets the minimum: the fresh quote does', async () => {
        const client = makeClient()
        // the display rate a Rates screen visit left in the cache
        client.setQueryData(['exchangeRate', AccountType.CLABE], '17')
        getExchangeRateMock.mockResolvedValue({ data: { sell_rate: '17' } })
        bridgeQuote({ mxn: '16.5' })

        const { result } = renderGate('MX', client)

        await waitFor(() => expect(result.current).toEqual({ minUsd: 3.04, status: 'ready' }))
        expect(getExchangeRateMock).not.toHaveBeenCalled()
        client.clear()
    })

    it('a failing quote blocks even while a direct display rate is cached and succeeding', async () => {
        const client = makeClient()
        client.setQueryData(['exchangeRate', AccountType.CLABE], '17')
        getExchangeRateMock.mockResolvedValue({ data: { sell_rate: '17' } })
        bridgeQuote({ mxn: { error: 'quote unavailable' } })

        const { result } = renderGate('MX', client)

        await waitFor(() => expect(result.current.status).toBe('unavailable'), QUOTE_ERROR_WAIT)
        expect(result.current.minUsd).toBeNull()
        client.clear()
    })

    it('quote failing: unavailable, no minimum — never a fabricated floor', async () => {
        bridgeQuote({ mxn: { error: 'upstream 500' } })
        const { result, client } = renderGate('MX')
        await waitFor(() => expect(result.current.status).toBe('unavailable'), QUOTE_ERROR_WAIT)
        expect(result.current.minUsd).toBeNull()
        client.clear()
    })

    it('pending until the quote arrives', () => {
        getOfframpQuoteMock.mockReturnValue(new Promise(() => {}))
        const { result, client } = renderGate('MX')
        expect(result.current).toEqual({ minUsd: null, status: 'pending' })
        client.clear()
    })

    it.each([
        ['empty', ''],
        ['zero', '0'],
        ['junk', '17junk'],
    ])('a quote with an unusable rate (%s) is unavailable, never a minimum', async (_label, rate) => {
        bridgeQuote({ mxn: rate })
        const { result, client } = renderGate('MX')
        await waitFor(() => expect(result.current).toEqual({ minUsd: null, status: 'unavailable' }))
        client.clear()
    })

    it('a refresh that fails blocks again — the retained quote is not current — and recovery restores it', async () => {
        bridgeQuote({ mxn: '17' })
        const { result, client } = renderGate('MX')
        await waitFor(() => expect(result.current.minUsd).toBe(2.95))

        bridgeQuote({ mxn: { error: 'upstream 500' } })
        await act(async () => {
            await client.refetchQueries({ queryKey: ['bridgeOfframpQuote', 'mxn', null] })
        })
        // react-query notifies observers on a macrotask after the fetch settles
        await waitFor(() => expect(result.current).toEqual({ minUsd: null, status: 'unavailable' }), QUOTE_ERROR_WAIT)

        bridgeQuote({ mxn: '16.5' })
        await act(async () => {
            await client.refetchQueries({ queryKey: ['bridgeOfframpQuote', 'mxn', null] })
        })
        await waitFor(() => expect(result.current).toEqual({ minUsd: 3.04, status: 'ready' }))
        client.clear()
    }, 15_000)

    it('GB uses the GBP quote (£3 at 0.79 → $3.80); a pair change never reuses another country', async () => {
        bridgeQuote({ gbp: '0.79', mxn: '17' })
        const { result, rerender, client } = renderGate('GB')
        await waitFor(() => expect(result.current.minUsd).toBe(3.8))
        expect(getOfframpQuoteMock).toHaveBeenCalledWith('gbp', undefined)

        rerender({ iso2: 'MX', on: true })
        await waitFor(() => expect(result.current.minUsd).toBe(2.95))
        client.clear()
    })

    it('CO uses the COP quote (4,000 COP at 4,000 → $1)', async () => {
        bridgeQuote({ cop: '4000' })
        const { result, client } = renderGate('CO')
        await waitFor(() => expect(result.current).toEqual({ minUsd: 1, status: 'ready' }))
        expect(getOfframpQuoteMock).toHaveBeenCalledWith('cop', undefined)
        client.clear()
    })

    it('an exact conversion stays on its cent: £3 at 0.75 is $4, not $4.01', async () => {
        bridgeQuote({ gbp: '0.75' })
        const { result, client } = renderGate('GB')
        await waitFor(() => expect(result.current).toEqual({ minUsd: 4, status: 'ready' }))
        client.clear()
    })

    it.each([
        ['US (USD → USD)', 'US'],
        ['a euro-area country', 'PT'],
        ['the euro area (no country)', ''],
        ['Argentina (Manteca)', 'AR'],
    ])('%s: the fixed $1 floor, ready, no quote request', (_label, iso2) => {
        const { result, client } = renderGate(iso2)
        expect(result.current).toEqual({ minUsd: 1, status: 'ready' })
        expect(getOfframpQuoteMock).not.toHaveBeenCalled()
        client.clear()
    })

    it('disabled (crypto, add-money, marketing): no request', () => {
        const { client } = renderGate('MX', makeClient(), false)
        expect(getOfframpQuoteMock).not.toHaveBeenCalled()
        client.clear()
    })
})
