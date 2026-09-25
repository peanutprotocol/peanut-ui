/**
 * The Bridge bank minimum, through the REAL rate hook and a shared QueryClient
 * with only the network mocked — so a mocked final rate string cannot hide a
 * fallback again. Every consumer (widget page, amount step, bank submit) reads
 * this gate, so what it says is what all three enforce.
 */
import { act, renderHook, waitFor } from '@testing-library/react'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AccountType } from '@/interfaces/interfaces'
import { useBankWithdrawMinimum } from '../useBankWithdrawMinimum'

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

const bridgeRate = (rates: Partial<Record<AccountType, string | { error: string }>>) =>
    getExchangeRateMock.mockImplementation(async (accountType: AccountType) => {
        const rate = rates[accountType]
        if (rate === undefined) return { error: 'no rate' }
        return typeof rate === 'string' ? { data: { sell_rate: rate } } : rate
    })

beforeEach(() => getExchangeRateMock.mockReset())

describe('useBankWithdrawMinimum', () => {
    it('MX at Bridge 17: $3 (ceil 50 / 17)', async () => {
        bridgeRate({ [AccountType.CLABE]: '17' })
        const { result, client } = renderGate('MX')
        await waitFor(() => expect(result.current).toEqual({ minUsd: 3, status: 'ready' }))
        expect(getExchangeRateMock).toHaveBeenCalledWith(AccountType.CLABE)
        client.clear()
    })

    it("MX at Bridge 16.5: $4 — Bridge's rate, whatever an indicative quote says", async () => {
        bridgeRate({ [AccountType.CLABE]: '16.5' })
        const { result, client } = renderGate('MX')
        await waitFor(() => expect(result.current).toEqual({ minUsd: 4, status: 'ready' }))
        client.clear()
    })

    it('Bridge rate failing: unavailable, no minimum — never the fabricated $50', async () => {
        bridgeRate({ [AccountType.CLABE]: { error: 'upstream 500' } })
        const { result, client } = renderGate('MX')
        await waitFor(() => expect(result.current.status).toBe('unavailable'))
        expect(result.current.minUsd).toBeNull()
        client.clear()
    })

    it('pending until the rate arrives', () => {
        getExchangeRateMock.mockReturnValue(new Promise(() => {}))
        const { result, client } = renderGate('MX')
        expect(result.current).toEqual({ minUsd: null, status: 'pending' })
        client.clear()
    })

    it('a refresh that fails blocks again, and recovery restores the matching threshold', async () => {
        bridgeRate({ [AccountType.CLABE]: '17' })
        const { result, client } = renderGate('MX')
        await waitFor(() => expect(result.current.minUsd).toBe(3))

        bridgeRate({ [AccountType.CLABE]: { error: 'upstream 500' } })
        await act(async () => {
            await client.refetchQueries({ queryKey: ['exchangeRate', AccountType.CLABE] })
        })
        // react-query notifies observers on a macrotask after the fetch settles
        await waitFor(() => expect(result.current).toEqual({ minUsd: null, status: 'unavailable' }))

        bridgeRate({ [AccountType.CLABE]: '16.5' })
        await act(async () => {
            await client.refetchQueries({ queryKey: ['exchangeRate', AccountType.CLABE] })
        })
        await waitFor(() => expect(result.current).toEqual({ minUsd: 4, status: 'ready' }))
        client.clear()
    })

    it('GB uses the GBP query (£3 at 0.79 → $4); a pair change never reuses another country', async () => {
        bridgeRate({ [AccountType.GB]: '0.79', [AccountType.CLABE]: '17' })
        const { result, rerender, client } = renderGate('GB')
        await waitFor(() => expect(result.current.minUsd).toBe(4))
        expect(getExchangeRateMock).toHaveBeenCalledWith(AccountType.GB)

        rerender({ iso2: 'MX', on: true })
        await waitFor(() => expect(result.current.minUsd).toBe(3))
        client.clear()
    })

    it.each([
        ['US (USD → USD)', 'US'],
        ['a euro-area country', 'PT'],
        ['the euro area (no country)', ''],
        ['Argentina (Manteca)', 'AR'],
    ])('%s: the fixed $1 floor, ready, no Bridge rate request', (_label, iso2) => {
        const { result, client } = renderGate(iso2)
        expect(result.current).toEqual({ minUsd: 1, status: 'ready' })
        expect(getExchangeRateMock).not.toHaveBeenCalled()
        client.clear()
    })

    it('disabled (crypto, add-money, marketing): no request', () => {
        const { client } = renderGate('MX', makeClient(), false)
        expect(getExchangeRateMock).not.toHaveBeenCalled()
        client.clear()
    })
})
