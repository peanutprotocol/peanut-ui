import { act, renderHook, waitFor } from '@testing-library/react'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import useGetExchangeRate from '@/hooks/useGetExchangeRate'
import { AccountType } from '@/interfaces/interfaces'

// `getExchangeRate` performs a server fetch in real use. We mock it to capture
// whether it was called — the regression test for PEANUT-UI-QHR is that
// non-Bridge AccountType values must NOT cause a network call.
const getExchangeRateMock = jest.fn()
jest.mock('@/app/actions/exchange-rate', () => ({
    getExchangeRate: (...args: unknown[]) => getExchangeRateMock(...args),
}))

const makeClient = () => new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } } })
function wrapperFor(client: QueryClient) {
    return function ClientWrapper({ children }: { children: React.ReactNode }) {
        return React.createElement(QueryClientProvider, { client }, children)
    }
}
// one client per mounted hook, stable across its re-renders
function FreshClientWrapper({ children }: { children: React.ReactNode }) {
    const [client] = React.useState(makeClient)
    return React.createElement(QueryClientProvider, { client }, children)
}
const wrapper = FreshClientWrapper

describe('useGetExchangeRate', () => {
    beforeEach(() => {
        getExchangeRateMock.mockReset()
    })

    it('returns 1 and skips the network call for AccountType.US (USD↔USD)', async () => {
        const { result } = renderHook(() => useGetExchangeRate({ accountType: AccountType.US }), { wrapper })
        await waitFor(() => expect(result.current.exchangeRate).toBe('1'))
        expect(getExchangeRateMock).not.toHaveBeenCalled()
    })

    // PEANUT-UI-QHR regression: the BE `/bridge/exchange-rate` enum is
    // {iban,us,clabe,gb}. Any other AccountType (MANTECA, EVM_ADDRESS,
    // PEANUT_WALLET) would 400 — the hook must short-circuit instead of
    // making the network call.
    it.each([AccountType.MANTECA, AccountType.EVM_ADDRESS, AccountType.PEANUT_WALLET])(
        'returns 1 and skips the network call for non-Bridge type: %s',
        async (accountType) => {
            const { result } = renderHook(() => useGetExchangeRate({ accountType }), { wrapper })
            await waitFor(() => expect(result.current.exchangeRate).toBe('1'))
            expect(getExchangeRateMock).not.toHaveBeenCalled()
        }
    )

    it.each([AccountType.IBAN, AccountType.CLABE, AccountType.GB])(
        'calls the network for Bridge FX type: %s and returns its sell_rate',
        async (accountType) => {
            getExchangeRateMock.mockResolvedValue({ data: { sell_rate: '1.05' } })
            const { result } = renderHook(() => useGetExchangeRate({ accountType }), { wrapper })
            await waitFor(() => expect(result.current.exchangeRate).toBe('1.05'))
            expect(getExchangeRateMock).toHaveBeenCalledWith(accountType)
        }
    )

    /**
     * A failed Bridge rate used to resolve as '1', which the MX minimum turned
     * into a fabricated $50. It is now an error with no rate — never a 1:1.
     */
    it.each([
        ['an API error', { error: 'upstream 500' }],
        ['a missing sell_rate', { data: {} }],
        ['an empty sell_rate', { data: { sell_rate: '' } }],
        ['a zero sell_rate', { data: { sell_rate: '0' } }],
        ['a negative sell_rate', { data: { sell_rate: '-1' } }],
        ['Infinity', { data: { sell_rate: 'Infinity' } }],
        ['NaN', { data: { sell_rate: 'NaN' } }],
        ['a junk suffix', { data: { sell_rate: '17junk' } }],
    ])('fails closed on %s: no rate, error state', async (_label, response) => {
        getExchangeRateMock.mockResolvedValue(response)
        const { result } = renderHook(() => useGetExchangeRate({ accountType: AccountType.CLABE }), { wrapper })
        await waitFor(() => expect(result.current.isError).toBe(true))
        expect(result.current.exchangeRate).toBeNull()
        expect(getExchangeRateMock).toHaveBeenCalledTimes(1) // no retry stampede
    })

    it('a background refresh that fails drops the retained rate, and recovery restores it', async () => {
        const client = makeClient()
        getExchangeRateMock.mockResolvedValueOnce({ data: { sell_rate: '17' } })
        const { result } = renderHook(() => useGetExchangeRate({ accountType: AccountType.CLABE }), {
            wrapper: wrapperFor(client),
        })
        await waitFor(() => expect(result.current.exchangeRate).toBe('17'))

        getExchangeRateMock.mockResolvedValueOnce({ error: 'upstream 500' })
        await act(async () => {
            await client.refetchQueries({ queryKey: ['exchangeRate', AccountType.CLABE] })
        })
        // react-query notifies observers on a macrotask after the fetch settles
        await waitFor(() => expect(result.current.isError).toBe(true))
        expect(result.current.exchangeRate).toBeNull()

        getExchangeRateMock.mockResolvedValueOnce({ data: { sell_rate: '16.5' } })
        await act(async () => {
            await client.refetchQueries({ queryKey: ['exchangeRate', AccountType.CLABE] })
        })
        await waitFor(() => expect(result.current.exchangeRate).toBe('16.5'))
        expect(result.current.isError).toBe(false)
        client.clear()
    })
})
