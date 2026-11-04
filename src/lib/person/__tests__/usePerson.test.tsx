import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { queryClient } from '@/config/queryClient'
import { serverFetch } from '@/utils/api-fetch'
import { fetchProfile } from '../personQuery'
import { usePerson } from '../usePerson'

// The real usersApi.getByUsername runs, so a 404 goes through the same path as in the app.
jest.mock('@/utils/api-fetch', () => ({ serverFetch: jest.fn() }))

const mockServerFetch = serverFetch as jest.MockedFunction<typeof serverFetch>

const response = (status: number, body: unknown) =>
    ({
        ok: status >= 200 && status < 300,
        status,
        json: () => Promise.resolve(body),
        text: () => Promise.resolve(JSON.stringify(body)),
    }) as unknown as Response

const alice = {
    userId: 'u-alice',
    username: 'alice',
    fullName: 'Alice Doe',
    showFullName: true,
    avatarKey: 'basic.cloud',
    accounts: [{ identifier: '0xa11ce', type: 'peanut-wallet' }],
    isVerified: true,
    badges: [{ code: 'OG', name: 'OG', description: null, iconUrl: null }],
}

let client: QueryClient
const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
)

beforeEach(() => {
    jest.clearAllMocks()
    client = new QueryClient()
})

describe('usePerson', () => {
    it('resolves the person and exposes the full profile', async () => {
        mockServerFetch.mockResolvedValue(response(200, alice))

        const { result } = renderHook(() => usePerson('Alice'), { wrapper })

        await waitFor(() => expect(result.current.person).not.toBeNull())
        expect(result.current.person).toMatchObject({
            userId: 'u-alice',
            username: 'alice',
            displayName: 'Alice Doe',
            avatarKey: 'basic.cloud',
        })
        expect(result.current.profile?.badges).toEqual(alice.badges)
        expect(mockServerFetch).toHaveBeenCalledWith('/users/username/alice', { method: 'GET' })
    })

    it('fetches a handle once for every surface that asks for it', async () => {
        mockServerFetch.mockResolvedValue(response(200, alice))

        const first = renderHook(() => usePerson('alice'), { wrapper })
        await waitFor(() => expect(first.result.current.person).not.toBeNull())
        const second = renderHook(() => usePerson('ALICE'), { wrapper })

        expect(second.result.current.person?.avatarKey).toBe('basic.cloud')
        expect(mockServerFetch).toHaveBeenCalledTimes(1)
    })

    // the URL parser fetches the recipient outside React; the views must not ask again
    it('reads the profile the URL parser fetched', async () => {
        mockServerFetch.mockResolvedValue(response(200, alice))
        client = queryClient
        client.clear()

        await fetchProfile('Alice')
        const { result } = renderHook(() => usePerson('alice'), { wrapper })

        expect(result.current.person?.avatarKey).toBe('basic.cloud')
        expect(mockServerFetch).toHaveBeenCalledTimes(1)
        client.clear()
    })

    it('fetchProfile asks the API again even when the cache is fresh', async () => {
        mockServerFetch.mockResolvedValue(response(200, alice))
        client = queryClient
        client.clear()

        await fetchProfile('alice')
        await fetchProfile('alice')

        expect(mockServerFetch).toHaveBeenCalledTimes(2)
        client.clear()
    })

    it('stays idle while there is no username', () => {
        const { result } = renderHook(() => usePerson(''), { wrapper })

        expect(result.current).toMatchObject({ person: null, profile: null, isLoading: false })
        expect(mockServerFetch).not.toHaveBeenCalled()
    })

    // an unknown or deactivated handle must not be cached as a profile, and a
    // 404 is the answer, so it is asked once
    it('reports a 404 as an error, once, with no person', async () => {
        mockServerFetch.mockResolvedValue(response(404, { error: 'User not found' }))

        const { result } = renderHook(() => usePerson('ghost'), { wrapper })

        await waitFor(() => expect(result.current.error).not.toBeNull())
        expect(result.current.person).toBeNull()
        expect(result.current.profile).toBeNull()
        expect(mockServerFetch).toHaveBeenCalledTimes(1)
    })
})
