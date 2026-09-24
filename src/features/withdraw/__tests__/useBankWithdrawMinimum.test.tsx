/**
 * The Bridge bank minimum, through the REAL rate hook and a shared QueryClient
 * with only the network mocked — so a mocked final rate string cannot hide a
 * fallback again. Every consumer (widget page, amount step, bank submit) reads
 * this gate, so what it says is what all three enforce.
 *
 * Fees v2: the rate is the public withdrawal rate (/bridge/offramp/rate), net
 * of Peanut's margin while it is collected, Bridge's own rate while it is off.
 */
import { act, renderHook, waitFor } from '@testing-library/react'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { apiFetch } from '@/utils/api-fetch'
import { useBankWithdrawMinimum } from '../useBankWithdrawMinimum'

jest.mock('@/utils/api-fetch', () => ({ apiFetch: jest.fn() }))
const mockApiFetch = apiFetch as jest.Mock

// the rate query keeps its own retry rule; only the wait between tries is removed
const makeClient = () => new QueryClient({ defaultOptions: { queries: { gcTime: 0, staleTime: 0, retryDelay: 0 } } })

const renderGate = (countryIso2: string, client = makeClient(), enabled = true) => {
    const wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(QueryClientProvider, { client }, children)
    const hook = renderHook(
        ({ iso2, on }: { iso2: string; on: boolean }) => useBankWithdrawMinimum(iso2, { enabled: on }),
        { wrapper, initialProps: { iso2: countryIso2, on: enabled } }
    )
    return { ...hook, client }
}

type RateAnswer = string | { status: number } | { updatedAt: string }

/** The public rate per currency: a rate string, an HTTP failure, or a stale stamp. */
const offrampRate = (rates: Partial<Record<string, RateAnswer>>, pricing = 'fixed_output') =>
    mockApiFetch.mockImplementation(async (url: string) => {
        const currency = new URL(url, 'https://api.test').searchParams.get('destinationCurrency') ?? ''
        const answer = rates[currency.toUpperCase()]
        if (answer === undefined || (typeof answer === 'object' && 'status' in answer)) {
            return { ok: false, status: typeof answer === 'object' ? answer.status : 404, headers: { get: () => null } }
        }
        const body = {
            destinationCurrency: currency,
            rate: typeof answer === 'string' ? answer : '0.75',
            updatedAt: typeof answer === 'string' ? new Date().toISOString() : answer.updatedAt,
            pricing,
        }
        return { ok: true, status: 200, json: async () => body }
    })

const requestedCurrencies = () =>
    mockApiFetch.mock.calls.map(([url]) => new URL(url, 'https://api.test').searchParams.get('destinationCurrency'))

beforeEach(() => mockApiFetch.mockReset())

describe('useBankWithdrawMinimum', () => {
    it('MX at 17: $3 (ceil 50 / 17)', async () => {
        offrampRate({ MXN: '17' })
        const { result, client } = renderGate('MX')
        await waitFor(() => expect(result.current).toEqual({ minUsd: 3, status: 'ready' }))
        expect(requestedCurrencies()).toEqual(['mxn'])
        client.clear()
    })

    it('MX at 16.5: $4 — the withdrawal rate, whatever an indicative quote says', async () => {
        offrampRate({ MXN: '16.5' })
        const { result, client } = renderGate('MX')
        await waitFor(() => expect(result.current).toEqual({ minUsd: 4, status: 'ready' }))
        client.clear()
    })

    /*
     * The margin moves the rounded minimum: Bridge's gross 0.75 would give
     * ceil(3 / 0.75) = $4, and $4 pays £2.99 at the net 0.74775 the withdrawal
     * uses — under the £3 floor. The net rate gives ceil(4.012) = $5.
     */
    it('GB with Peanut’s margin inside the rate (0.75 × 0.997): $5, not the gross $4', async () => {
        offrampRate({ GBP: '0.74775' })
        const { result, client } = renderGate('GB')
        await waitFor(() => expect(result.current).toEqual({ minUsd: 5, status: 'ready' }))
        client.clear()
    })

    it('GB with collection off (Bridge’s own 0.75): $4, as before fees v2', async () => {
        offrampRate({ GBP: '0.75' }, 'bridge_rate')
        const { result, client } = renderGate('GB')
        await waitFor(() => expect(result.current).toEqual({ minUsd: 4, status: 'ready' }))
        client.clear()
    })

    it('rate failing: unavailable, no minimum — never the fabricated $50, never a gross-rate fallback', async () => {
        offrampRate({ MXN: { status: 500 } })
        const { result, client } = renderGate('MX')
        await waitFor(() => expect(result.current.status).toBe('unavailable'))
        expect(result.current.minUsd).toBeNull()
        client.clear()
    })

    it('a stale rate stamp is unusable: unavailable, not an old rate shown as current', async () => {
        offrampRate({ MXN: { updatedAt: '2026-01-01T00:00:00.000Z' } })
        const { result, client } = renderGate('MX')
        await waitFor(() => expect(result.current).toEqual({ minUsd: null, status: 'unavailable' }))
        client.clear()
    })

    it('pending until the rate arrives', () => {
        mockApiFetch.mockReturnValue(new Promise(() => {}))
        const { result, client } = renderGate('MX')
        expect(result.current).toEqual({ minUsd: null, status: 'pending' })
        client.clear()
    })

    it('a refresh that fails blocks again, and recovery restores the matching threshold', async () => {
        offrampRate({ MXN: '17' })
        const { result, client } = renderGate('MX')
        await waitFor(() => expect(result.current.minUsd).toBe(3))

        offrampRate({ MXN: { status: 500 } })
        await act(async () => {
            await client.refetchQueries({ queryKey: ['offrampRate', 'MXN'] })
        })
        // react-query notifies observers on a macrotask after the fetch settles
        await waitFor(() => expect(result.current).toEqual({ minUsd: null, status: 'unavailable' }))

        offrampRate({ MXN: '16.5' })
        await act(async () => {
            await client.refetchQueries({ queryKey: ['offrampRate', 'MXN'] })
        })
        await waitFor(() => expect(result.current).toEqual({ minUsd: 4, status: 'ready' }))
        client.clear()
    })

    it('GB uses the GBP rate (£3 at 0.79 → $4); a pair change never reuses another country', async () => {
        offrampRate({ GBP: '0.79', MXN: '17' })
        const { result, rerender, client } = renderGate('GB')
        await waitFor(() => expect(result.current.minUsd).toBe(4))
        expect(requestedCurrencies()).toEqual(['gbp'])

        rerender({ iso2: 'MX', on: true })
        await waitFor(() => expect(result.current.minUsd).toBe(3))
        client.clear()
    })

    it.each([
        ['US (USD → USD)', 'US'],
        ['a euro-area country', 'PT'],
        ['the euro area (no country)', ''],
        ['Argentina (Manteca)', 'AR'],
    ])('%s: the fixed $1 floor, ready, no rate request', (_label, iso2) => {
        const { result, client } = renderGate(iso2)
        expect(result.current).toEqual({ minUsd: 1, status: 'ready' })
        expect(mockApiFetch).not.toHaveBeenCalled()
        client.clear()
    })

    it('disabled (crypto, add-money, marketing): no request', () => {
        const { client } = renderGate('MX', makeClient(), false)
        expect(mockApiFetch).not.toHaveBeenCalled()
        client.clear()
    })
})
