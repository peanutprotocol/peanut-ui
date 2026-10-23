import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { AVATAR_ART } from '@/constants/query.consts'
import { useAvatarArt } from '../useAvatarArt'

// jest.setup.ts stubs this hook for every other suite (jest hoists this call)
jest.unmock('../useAvatarArt')

const mockApiFetch = jest.fn()
jest.mock('@/utils/api-fetch', () => ({ apiFetch: (...args: unknown[]) => mockApiFetch(...args) }))

const renderArt = () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
    )
    return { client, ...renderHook(() => useAvatarArt(), { wrapper }) }
}

describe('useAvatarArt', () => {
    beforeEach(() => mockApiFetch.mockReset())

    it('returns the served map, fetched without auth', async () => {
        const map = { 'basic.frog': 'https://api.peanut.me/badges/art/avatar-basic-frog.0123456789ab.webp' }
        mockApiFetch.mockResolvedValue({ ok: true, json: async () => map })
        const { result } = renderArt()

        await waitFor(() => expect(result.current).toEqual(map))
        expect(mockApiFetch).toHaveBeenCalledWith('/avatars/art', expect.objectContaining({ includeAuth: false }))
    })

    // an API without the route: the bundled art stays
    it.each([
        ['a 404', () => mockApiFetch.mockResolvedValue({ ok: false, json: async () => ({}) })],
        ['a network error', () => mockApiFetch.mockRejectedValue(new TypeError('Failed to fetch'))],
        ['a non-object body', () => mockApiFetch.mockResolvedValue({ ok: true, json: async () => ['x'] })],
    ])('reads %s as an empty map', async (_, arrange) => {
        arrange()
        const { client, result } = renderArt()

        // resolved to {}, not a failed query that retries
        await waitFor(() => expect(client.getQueryData([AVATAR_ART])).toEqual({}))
        expect(result.current).toEqual({})
    })
})
