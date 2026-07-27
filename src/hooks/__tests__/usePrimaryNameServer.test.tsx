import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { usePrimaryNameServer } from '../usePrimaryNameServer'
import { serverFetch } from '@/utils/api-fetch'

jest.mock('@/utils/api-fetch', () => ({ serverFetch: jest.fn() }))

const mockServerFetch = serverFetch as jest.MockedFunction<typeof serverFetch>

const wrapper = ({ children }: { children: ReactNode }) => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

const ADDRESS = '0x1bbb000000000000000000000000000000ea0349'

const jsonResponse = (body: unknown, ok = true) => ({ ok, json: async () => body }) as unknown as Response

beforeEach(() => jest.clearAllMocks())

describe('usePrimaryNameServer', () => {
    it('resolves the address to its primary name via the backend', async () => {
        mockServerFetch.mockResolvedValue(jsonResponse({ name: 'alice.eth' }))
        const { result } = renderHook(() => usePrimaryNameServer(ADDRESS), { wrapper })
        await waitFor(() => expect(result.current.primaryName).toBe('alice.eth'))
        expect(mockServerFetch).toHaveBeenCalledWith(`/ens/reverse/${ADDRESS}`, { method: 'GET' })
    })

    it('returns undefined when the backend reports no name', async () => {
        mockServerFetch.mockResolvedValue(jsonResponse({ name: null }))
        const { result } = renderHook(() => usePrimaryNameServer(ADDRESS), { wrapper })
        await waitFor(() => expect(mockServerFetch).toHaveBeenCalled())
        expect(result.current.primaryName).toBeUndefined()
    })

    it('fails safe to undefined on a non-OK response (e.g. route not deployed)', async () => {
        mockServerFetch.mockResolvedValue(jsonResponse({}, false))
        const { result } = renderHook(() => usePrimaryNameServer(ADDRESS), { wrapper })
        await waitFor(() => expect(mockServerFetch).toHaveBeenCalled())
        expect(result.current.primaryName).toBeUndefined()
    })

    it('does not query for a non-address input', () => {
        renderHook(() => usePrimaryNameServer('not-an-address'), { wrapper })
        expect(mockServerFetch).not.toHaveBeenCalled()
    })

    it('does not query when address is undefined', () => {
        renderHook(() => usePrimaryNameServer(undefined), { wrapper })
        expect(mockServerFetch).not.toHaveBeenCalled()
    })
})
