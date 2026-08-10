import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useCardMarkupRate } from '@/hooks/useCardMarkupRate'
import { fetchCardMarkup } from '@/utils/fx.utils'

jest.mock('@/utils/fx.utils', () => ({ fetchCardMarkup: jest.fn() }))

const mockFetchCardMarkup = fetchCardMarkup as jest.Mock

function wrapper({ children }: { children: ReactNode }) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

describe('useCardMarkupRate', () => {
    beforeEach(() => mockFetchCardMarkup.mockReset())

    it('serves the backend markup when the call succeeds', async () => {
        mockFetchCardMarkup.mockResolvedValue({ rate: 0.0536, source: 'live' })

        const { result } = renderHook(() => useCardMarkupRate('ars', 1600), { wrapper })

        await waitFor(() => expect(result.current.data).toEqual({ rate: 0.0536, source: 'live' }))
        expect(mockFetchCardMarkup).toHaveBeenCalledWith('ARS', 1600)
    })

    it('falls back to the static table rather than failing a payment surface', async () => {
        mockFetchCardMarkup.mockRejectedValue(new Error('FX API returned 503'))

        const { result } = renderHook(() => useCardMarkupRate('ARS'), { wrapper })

        await waitFor(() => expect(result.current.data).toEqual({ rate: 0.0913, source: 'static' }))
        expect(result.current.isError).toBe(false)
    })

    it('returns null for a currency with no modeled comparison, so callers hide the row', async () => {
        mockFetchCardMarkup.mockRejectedValue(new Error('FX API returned 404'))

        const { result } = renderHook(() => useCardMarkupRate('JPY'), { wrapper })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        expect(result.current.data).toBeNull()
    })

    it('does not fetch without a currency', () => {
        const { result } = renderHook(() => useCardMarkupRate(undefined), { wrapper })

        expect(mockFetchCardMarkup).not.toHaveBeenCalled()
        expect(result.current.fetchStatus).toBe('idle')
    })
})
