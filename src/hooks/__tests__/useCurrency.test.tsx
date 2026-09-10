import { act, renderHook, waitFor } from '@testing-library/react'
import { useCurrency } from '@/hooks/useCurrency'
import { getCachedCurrencyPrice } from '@/app/actions/currency'

jest.mock('@/app/actions/currency', () => ({ getCachedCurrencyPrice: jest.fn() }))

const mockGetCachedCurrencyPrice = getCachedCurrencyPrice as jest.Mock

describe('useCurrency', () => {
    beforeEach(() => {
        mockGetCachedCurrencyPrice.mockReset()
        jest.spyOn(console, 'error').mockImplementation(() => {})
    })

    afterEach(() => jest.restoreAllMocks())

    it('exposes the fetched rate', async () => {
        mockGetCachedCurrencyPrice.mockResolvedValue({ buy: 1400, sell: 1350 })

        const { result } = renderHook(() => useCurrency('ars'))

        await waitFor(() => expect(result.current.isLoading).toBe(false))
        expect(result.current.price).toEqual({ buy: 1400, sell: 1350 })
        expect(result.current.symbol).toBe('ARS')
        expect(result.current.isError).toBe(false)
    })

    it('flags a failed fetch instead of leaving the consumer loading forever', async () => {
        mockGetCachedCurrencyPrice.mockRejectedValue(new Error('timeout'))

        const { result } = renderHook(() => useCurrency('ARS'))

        await waitFor(() => expect(result.current.isError).toBe(true))
        expect(result.current.isLoading).toBe(false)
        expect(result.current.price).toBeNull()
    })

    // #1848: without refetch, a rate outage strands the user on the error state
    // until they leave the screen — the effect only re-runs when `code` changes.
    it('refetch recovers from a failure without remounting', async () => {
        mockGetCachedCurrencyPrice.mockRejectedValueOnce(new Error('timeout'))
        mockGetCachedCurrencyPrice.mockResolvedValueOnce({ buy: 1400, sell: 1350 })

        const { result } = renderHook(() => useCurrency('ARS'))

        await waitFor(() => expect(result.current.isError).toBe(true))

        act(() => result.current.refetch())

        await waitFor(() => expect(result.current.price).toEqual({ buy: 1400, sell: 1350 }))
        expect(result.current.isError).toBe(false)
        expect(mockGetCachedCurrencyPrice).toHaveBeenCalledTimes(2)
    })

    it('ignores a superseded response that lands after a newer one', async () => {
        let resolveArs: (value: { buy: number; sell: number }) => void = () => {}
        mockGetCachedCurrencyPrice.mockImplementationOnce(
            () => new Promise<{ buy: number; sell: number }>((resolve) => (resolveArs = resolve))
        )
        mockGetCachedCurrencyPrice.mockResolvedValueOnce({ buy: 5.4, sell: 5.3 })

        const { result, rerender } = renderHook(({ code }) => useCurrency(code), {
            initialProps: { code: 'ARS' },
        })

        rerender({ code: 'BRL' })
        await waitFor(() => expect(result.current.price).toEqual({ buy: 5.4, sell: 5.3 }))

        // The abandoned ARS request finally lands — it must not overwrite BRL.
        act(() => resolveArs({ buy: 1400, sell: 1350 }))

        await waitFor(() => expect(result.current.price).toEqual({ buy: 5.4, sell: 5.3 }))
        expect(result.current.symbol).toBe('R$')
    })

    // #1848: callers read the currency off `useSearchParams()`, which is empty on
    // the first render of a statically exported page. The hook used to seed
    // `code` once and ignore the prop afterwards, so it never fetched and the
    // withdraw screen sat on a loader that never resolved.
    it('fetches when the currency only arrives after the first render', async () => {
        mockGetCachedCurrencyPrice.mockResolvedValue({ buy: 1400, sell: 1350 })

        const { result, rerender } = renderHook(({ code }) => useCurrency(code), {
            initialProps: { code: null as string | null },
        })

        await waitFor(() => expect(result.current.isLoading).toBe(false))
        expect(mockGetCachedCurrencyPrice).not.toHaveBeenCalled()

        rerender({ code: 'ARS' })

        // Consumers must never see a settled no-rate state in the gap before the
        // fetch starts — that reads as "rate unavailable" and flashes an error.
        expect(result.current.isLoading).toBe(true)

        await waitFor(() => expect(result.current.price).toEqual({ buy: 1400, sell: 1350 }))
        expect(result.current.code).toBe('ARS')
    })

    // Consumers gate on `price`, so a retained rate would price the new currency
    // with the old one's number.
    it('drops the previous currency rate when the next fetch fails', async () => {
        mockGetCachedCurrencyPrice.mockResolvedValueOnce({ buy: 1400, sell: 1350 })
        mockGetCachedCurrencyPrice.mockRejectedValueOnce(new Error('timeout'))

        const { result, rerender } = renderHook(({ code }) => useCurrency(code), {
            initialProps: { code: 'ARS' },
        })

        await waitFor(() => expect(result.current.price).toEqual({ buy: 1400, sell: 1350 }))

        rerender({ code: 'BRL' })

        await waitFor(() => expect(result.current.isError).toBe(true))
        expect(result.current.price).toBeNull()
        expect(result.current.symbol).toBeNull()
    })

    it('short-circuits USD without a network call', async () => {
        const { result } = renderHook(() => useCurrency('USD'))

        await waitFor(() => expect(result.current.isLoading).toBe(false))
        expect(result.current.price).toEqual({ buy: 1, sell: 1 })
        expect(mockGetCachedCurrencyPrice).not.toHaveBeenCalled()
    })
})
