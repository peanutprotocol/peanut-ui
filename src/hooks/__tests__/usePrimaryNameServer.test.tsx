import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { usePrimaryName } from '@justaname.id/react'
import { usePrimaryNameServer } from '../usePrimaryNameServer'
import { serverFetch } from '@/utils/api-fetch'

jest.mock('@/utils/api-fetch', () => ({ serverFetch: jest.fn() }))

const mockServerFetch = serverFetch as jest.MockedFunction<typeof serverFetch>
// resolves to the shared manual mock via jest moduleNameMapper
const mockUsePrimaryName = usePrimaryName as jest.Mock

const wrapper = ({ children }: { children: ReactNode }) => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

const ADDRESS = '0x1bbb000000000000000000000000000000ea0349'

const jsonResponse = (body: unknown, ok = true) => ({ ok, json: async () => body }) as unknown as Response

beforeEach(() => {
    jest.clearAllMocks()
    window.localStorage.clear()
    mockUsePrimaryName.mockReturnValue({ primaryName: undefined, isLoading: false, error: null })
})

describe('usePrimaryNameServer', () => {
    it('resolves the address to its primary name via the backend', async () => {
        mockServerFetch.mockResolvedValue(jsonResponse({ name: 'alice.eth' }))
        const { result } = renderHook(() => usePrimaryNameServer(ADDRESS), { wrapper })
        await waitFor(() => expect(result.current.primaryName).toBe('alice.eth'))
        expect(mockServerFetch).toHaveBeenCalledWith(`/ens/reverse/${ADDRESS}`, { method: 'GET' })
        // client fallback stays a no-op while the server path works
        expect(mockUsePrimaryName).toHaveBeenLastCalledWith(expect.objectContaining({ address: undefined }))
    })

    it('returns undefined when the backend reports no name', async () => {
        const json = jest.fn(async () => ({ name: null }))
        mockServerFetch.mockResolvedValue({ ok: true, json } as unknown as Response)
        const { result } = renderHook(() => usePrimaryNameServer(ADDRESS), { wrapper })
        // wait for the resolved-null query to re-render the hook, not just for the fetch call
        await waitFor(() => expect(mockUsePrimaryName.mock.calls.length).toBeGreaterThan(1))
        expect(result.current.primaryName).toBeUndefined()
        // a live endpoint answering "no name" is authoritative — client fallback stays disabled
        expect(mockUsePrimaryName).toHaveBeenLastCalledWith(expect.objectContaining({ address: undefined }))
    })

    it('falls back to the client-side lookup on a non-OK response (e.g. route not deployed)', async () => {
        mockServerFetch.mockResolvedValue(jsonResponse({}, false))
        mockUsePrimaryName.mockReturnValue({ primaryName: 'alice.eth', isLoading: false, error: null })
        const { result } = renderHook(() => usePrimaryNameServer(ADDRESS), { wrapper })
        await waitFor(() => expect(result.current.primaryName).toBe('alice.eth'))
        expect(mockUsePrimaryName).toHaveBeenLastCalledWith(expect.objectContaining({ address: ADDRESS }))
    })

    it('fails safe to undefined when both server and client lookups fail', async () => {
        mockServerFetch.mockResolvedValue(jsonResponse({}, false))
        const { result } = renderHook(() => usePrimaryNameServer(ADDRESS), { wrapper })
        await waitFor(() =>
            expect(mockUsePrimaryName).toHaveBeenLastCalledWith(expect.objectContaining({ address: ADDRESS }))
        )
        expect(result.current.primaryName).toBeUndefined()
    })

    it('paints the cached name immediately on mount while the lookup is pending', async () => {
        // seed the warm cache via a first mount that resolves
        mockServerFetch.mockResolvedValue(jsonResponse({ name: 'alice.eth' }))
        const first = renderHook(() => usePrimaryNameServer(ADDRESS), { wrapper })
        await waitFor(() => expect(first.result.current.primaryName).toBe('alice.eth'))
        first.unmount()

        // fresh mount with a never-resolving lookup — cached name shows at once
        mockServerFetch.mockImplementation(() => new Promise(() => {}))
        const { result } = renderHook(() => usePrimaryNameServer(ADDRESS), { wrapper })
        expect(result.current.primaryName).toBe('alice.eth')
    })

    it('does not show a stale cached name once the server settles with no name', async () => {
        window.localStorage.setItem(
            'ens-primary-name-cache',
            JSON.stringify({ [ADDRESS.toLowerCase()]: { name: 'stale.eth', ts: Date.now() } })
        )
        mockServerFetch.mockResolvedValue(jsonResponse({ name: null }))
        const { result } = renderHook(() => usePrimaryNameServer(ADDRESS), { wrapper })
        await waitFor(() => expect(result.current.primaryName).toBeUndefined())
        // authoritative "no name" also evicts the cache entry
        await waitFor(() => expect(window.localStorage.getItem('ens-primary-name-cache')).not.toContain('stale.eth'))
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
