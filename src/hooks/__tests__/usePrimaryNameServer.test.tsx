import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { usePrimaryNameServer } from '../usePrimaryNameServer'
import { serverFetch } from '@/utils/api-fetch'
import { lookupPrimaryNameOnChain } from '@/utils/ens-onchain.utils'

jest.mock('@/utils/api-fetch', () => ({ serverFetch: jest.fn() }))
jest.mock('@/utils/ens-onchain.utils', () => ({ lookupPrimaryNameOnChain: jest.fn() }))

const mockServerFetch = serverFetch as jest.MockedFunction<typeof serverFetch>
const mockOnChainLookup = lookupPrimaryNameOnChain as jest.MockedFunction<typeof lookupPrimaryNameOnChain>

const wrapper = ({ children }: { children: ReactNode }) => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

const ADDRESS = '0x1bbb000000000000000000000000000000ea0349'

const jsonResponse = (body: unknown, ok = true) => ({ ok, json: async () => body }) as unknown as Response

beforeEach(() => {
    jest.clearAllMocks()
    window.localStorage.clear()
    mockOnChainLookup.mockRejectedValue(new Error('no on-chain lookup configured in test'))
})

describe('usePrimaryNameServer', () => {
    it('resolves the address to its primary name via the backend', async () => {
        mockServerFetch.mockResolvedValue(jsonResponse({ name: 'alice.eth' }))
        const { result } = renderHook(() => usePrimaryNameServer(ADDRESS), { wrapper })
        await waitFor(() => expect(result.current.primaryName).toBe('alice.eth'))
        expect(mockServerFetch).toHaveBeenCalledWith(`/ens/reverse/${ADDRESS}`, { method: 'GET' })
        // client fallback stays a no-op while the server path works
        expect(mockOnChainLookup).not.toHaveBeenCalled()
    })

    it('returns undefined when the backend reports no name', async () => {
        mockServerFetch.mockResolvedValue(jsonResponse({ name: null }))
        const { result } = renderHook(() => usePrimaryNameServer(ADDRESS), { wrapper })
        await waitFor(() => expect(mockServerFetch).toHaveBeenCalled())
        expect(result.current.primaryName).toBeUndefined()
        // a live endpoint answering "no name" is authoritative — client fallback stays disabled
        expect(mockOnChainLookup).not.toHaveBeenCalled()
    })

    it('falls back to the client-side lookup on a non-OK response (e.g. route not deployed)', async () => {
        mockServerFetch.mockResolvedValue(jsonResponse({}, false))
        mockOnChainLookup.mockResolvedValue('alice.eth')
        const { result } = renderHook(() => usePrimaryNameServer(ADDRESS), { wrapper })
        await waitFor(() => expect(result.current.primaryName).toBe('alice.eth'))
        expect(mockOnChainLookup).toHaveBeenCalledWith(ADDRESS)
    })

    it('fails safe to undefined when both server and client lookups fail', async () => {
        mockServerFetch.mockResolvedValue(jsonResponse({}, false))
        const { result } = renderHook(() => usePrimaryNameServer(ADDRESS), { wrapper })
        await waitFor(() => expect(mockOnChainLookup).toHaveBeenCalledWith(ADDRESS))
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

    it('evicts the cached name when the client fallback settles with no name', async () => {
        window.localStorage.setItem(
            'ens-primary-name-cache',
            JSON.stringify({ [ADDRESS.toLowerCase()]: { name: 'stale.eth', ts: Date.now() } })
        )
        mockServerFetch.mockResolvedValue(jsonResponse({}, false))
        // the on-chain lookup settles "not found" as '' (a rejection would mean "couldn't check")
        mockOnChainLookup.mockResolvedValue('')
        const { result } = renderHook(() => usePrimaryNameServer(ADDRESS), { wrapper })
        await waitFor(() => expect(window.localStorage.getItem('ens-primary-name-cache')).not.toContain('stale.eth'))
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
