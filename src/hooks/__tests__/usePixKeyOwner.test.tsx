import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { pixKeyOwnerQueryOptions, usePixKeyOwner } from '@/hooks/usePixKeyOwner'
import { mantecaApi } from '@/services/manteca'

jest.mock('@/services/manteca', () => ({ mantecaApi: { getPixKeyOwner: jest.fn() } }))

const mockGetPixKeyOwner = mantecaApi.getPixKeyOwner as jest.Mock
const PIX_KEY = 'maria@silva.com.br'
const OWNER = { name: 'MARIA DA SILVA', legalIdMasked: '12*******90' }

// No retry override on the client: the hook's own options must stop retries.
const withClient = (client: QueryClient) =>
    function Wrapper({ children }: { children: ReactNode }) {
        return <QueryClientProvider client={client}>{children}</QueryClientProvider>
    }

describe('usePixKeyOwner', () => {
    beforeEach(() => mockGetPixKeyOwner.mockReset())

    it('looks nothing up without a key', () => {
        const { result } = renderHook(() => usePixKeyOwner(null), { wrapper: withClient(new QueryClient()) })

        expect(result.current.fetchStatus).toBe('idle')
        expect(mockGetPixKeyOwner).not.toHaveBeenCalled()
    })

    it("reuses the key screen's lookup instead of spending a second one", async () => {
        mockGetPixKeyOwner.mockResolvedValue(OWNER)
        const client = new QueryClient()
        await client.fetchQuery(pixKeyOwnerQueryOptions(PIX_KEY))

        const { result } = renderHook(() => usePixKeyOwner(PIX_KEY), { wrapper: withClient(client) })

        expect(result.current.data).toEqual(OWNER)
        expect(mockGetPixKeyOwner).toHaveBeenCalledTimes(1)
    })

    it('keeps its answer and spends no lookup when every query is invalidated (native pull-to-refresh)', async () => {
        mockGetPixKeyOwner.mockResolvedValue(OWNER)
        const client = new QueryClient()
        const { result } = renderHook(() => usePixKeyOwner(PIX_KEY), { wrapper: withClient(client) })
        await waitFor(() => expect(result.current.data).toEqual(OWNER))

        await client.invalidateQueries()

        expect(result.current.data).toEqual(OWNER)
        expect(mockGetPixKeyOwner).toHaveBeenCalledTimes(1)
    })

    it('does not retry a failed lookup', async () => {
        mockGetPixKeyOwner.mockRejectedValue(new Error('PIX key lookup failed'))

        const { result } = renderHook(() => usePixKeyOwner(PIX_KEY), { wrapper: withClient(new QueryClient()) })

        await waitFor(() => expect(result.current.isError).toBe(true))
        expect(result.current.data).toBeUndefined()
        expect(mockGetPixKeyOwner).toHaveBeenCalledTimes(1)
    })

    it('does not repeat a failed lookup when /qr-pay mounts after the key screen', async () => {
        mockGetPixKeyOwner.mockRejectedValue(new Error('PIX key lookup failed'))
        const client = new QueryClient()
        await expect(client.fetchQuery(pixKeyOwnerQueryOptions(PIX_KEY))).rejects.toThrow()

        const { result } = renderHook(() => usePixKeyOwner(PIX_KEY), { wrapper: withClient(client) })

        expect(result.current.fetchStatus).toBe('idle')
        expect(mockGetPixKeyOwner).toHaveBeenCalledTimes(1)
    })
})
