/** @jest-environment jsdom */
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useKycIntents } from '@/hooks/useKycIntents'
import { apiFetch } from '@/utils/api-fetch'
import { type PropsWithChildren } from 'react'

jest.mock('@/utils/api-fetch', () => ({ apiFetch: jest.fn() }))
const fetchMock = apiFetch as jest.Mock
const payload = (currencies: unknown) => ({
    intents: {
        qr: { available: true },
        local: { available: false },
        card: { available: true },
        bank: { available: true, currencies },
    },
})
function wrapper() {
    const client = new QueryClient({ defaultOptions: { queries: { retryDelay: 0, gcTime: 0 } } })
    return function Wrapper({ children }: PropsWithChildren) {
        return <QueryClientProvider client={client}>{children}</QueryClientProvider>
    }
}
beforeEach(() => jest.clearAllMocks())

it('keeps the served currency order and makes a public residence-scoped request', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => payload(['MXN', 'USD']) })
    const { result } = renderHook(() => useKycIntents(' mx '), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.settled).toBe(true))
    expect(result.current.intents?.bank.currencies).toEqual(['MXN', 'USD'])
    expect(fetchMock).toHaveBeenCalledWith('/config/kyc-intents?residence=MX', { includeAuth: false })
})

it.each([undefined, null, 'USD', [17]])('withholds malformed currency payload %j', async (currencies) => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => payload(currencies) })
    const { result } = renderHook(() => useKycIntents('PT'), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.settled).toBe(true))
    expect(result.current.intents).toBeUndefined()
    expect(fetchMock).toHaveBeenCalledTimes(2)
})

it('does not replace a valid empty served currency list', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => payload([]) })
    const { result } = renderHook(() => useKycIntents('PT'), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.intents?.bank.currencies).toEqual([]))
})

it('does not publish a late response for the previous residence', async () => {
    let finish!: (value: unknown) => void
    fetchMock
        .mockReturnValueOnce(
            new Promise((resolve) => {
                finish = resolve
            })
        )
        .mockResolvedValueOnce({ ok: true, json: async () => payload(['MXN']) })
    const { result, rerender } = renderHook(({ country }) => useKycIntents(country), {
        initialProps: { country: 'PT' },
        wrapper: wrapper(),
    })
    rerender({ country: 'MX' })
    await waitFor(() => expect(result.current.intents?.bank.currencies).toEqual(['MXN']))
    await act(async () => {
        finish({ ok: true, json: async () => payload(['EUR']) })
    })
    expect(result.current.intents?.bank.currencies).toEqual(['MXN'])
})

it('withholds a failed intents read without inventing currencies', async () => {
    fetchMock.mockRejectedValue(new Error('offline'))
    const { result } = renderHook(() => useKycIntents('PT'), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.settled).toBe(true))
    expect(result.current.intents).toBeUndefined()
    expect(fetchMock).toHaveBeenCalledTimes(2)
})
