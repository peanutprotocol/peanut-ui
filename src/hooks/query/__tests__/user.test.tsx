import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { useUserQuery } from '../user'
import { apiFetch } from '@/utils/api-fetch'
import { setAuthToken, clearAuthToken } from '@/utils/auth-token'
import { isDemoMode } from '@/utils/demo'

jest.mock('@/utils/api-fetch', () => ({ apiFetch: jest.fn() }))
jest.mock('@/utils/auth-token', () => ({
    setAuthToken: jest.fn(),
    clearAuthToken: jest.fn(),
    getAuthToken: jest.fn(() => null),
    getClearEpoch: jest.fn(() => 0),
}))
jest.mock('@/hooks/usePWAStatus', () => ({ usePWAStatus: () => false, isStandaloneDisplayMode: () => false }))
jest.mock('@/hooks/useGetDeviceType', () => ({ useDeviceType: () => ({ deviceType: 'desktop' }) }))
jest.mock('posthog-js', () => {
    // one shared instance so the hook resolves the same mocks whichever
    // interop path (default vs namespace) jest picks
    const instance = { capture: jest.fn(), get_session_id: jest.fn(() => '') }
    return { ...instance, default: instance }
})
jest.mock('@/utils/demo', () => ({ isDemoMode: jest.fn(() => false) }))
// demo-api → demo → general.utils → app/actions/clients starts viem timers that keep the worker alive
jest.mock('@/app/actions/clients', () => ({}))

const mockApiFetch = apiFetch as jest.MockedFunction<typeof apiFetch>
const mockSetAuthToken = setAuthToken as jest.MockedFunction<typeof setAuthToken>
const mockClearAuthToken = clearAuthToken as jest.MockedFunction<typeof clearAuthToken>

function makeWrapper() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
    const Wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
    )
    Wrapper.displayName = 'TestQueryClientWrapper'
    return Wrapper
}

function mockResponse(status: number, body: unknown): Response {
    return {
        ok: status >= 200 && status < 300,
        status,
        json: () => Promise.resolve(body),
    } as unknown as Response
}

describe('useUserQuery — JWT sliding refresh', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockApiFetch.mockReset()
    })

    it('calls setAuthToken when the response includes a refreshed token', async () => {
        const refreshed = 'new.jwt.token'
        mockApiFetch.mockResolvedValueOnce(
            mockResponse(200, { user: { userId: 'u1', username: 'alice' }, token: refreshed })
        )

        const { result } = renderHook(() => useUserQuery(), { wrapper: makeWrapper() })
        await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 5000 })

        expect(mockSetAuthToken).toHaveBeenCalledWith(refreshed)
        expect(mockSetAuthToken).toHaveBeenCalledTimes(1)
    })

    it('drops a refreshed token when the session was cleared mid-flight (epoch changed)', async () => {
        const { getClearEpoch } = jest.requireMock('@/utils/auth-token')
        // epoch reads: once before the request, once after — logout in between
        getClearEpoch.mockReturnValueOnce(0).mockReturnValueOnce(1)
        mockApiFetch.mockResolvedValueOnce(
            mockResponse(200, { user: { userId: 'u1', username: 'alice' }, token: 'resurrected.jwt' })
        )
        mockApiFetch.mockResolvedValueOnce(mockResponse(200, { user: { userId: 'u2', username: 'bob' } }))

        const { result } = renderHook(() => useUserQuery(), { wrapper: makeWrapper() })
        await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 5000 })

        expect(mockSetAuthToken).not.toHaveBeenCalled()
        expect(result.current.data).toMatchObject({ user: { userId: 'u2' } })
    })

    it('discards an old successful body when another login commits while JSON is being read', async () => {
        const { getAuthToken } = jest.requireMock('@/utils/auth-token')
        getAuthToken.mockReturnValue('old-session')
        mockApiFetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => {
                getAuthToken.mockReturnValue('new-session')
                return { user: { userId: 'old-user' }, token: 'old-refreshed-token' }
            },
        } as Response)
        mockApiFetch.mockResolvedValueOnce(mockResponse(200, { user: { userId: 'new-user' } }))
        try {
            const { result } = renderHook(() => useUserQuery(), { wrapper: makeWrapper() })
            await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 5000 })
            expect(result.current.data).toMatchObject({ user: { userId: 'new-user' } })
            expect(mockSetAuthToken).not.toHaveBeenCalled()
        } finally {
            getAuthToken.mockReturnValue(null)
        }
    })

    it('does NOT call setAuthToken when the response has no token field', async () => {
        mockApiFetch.mockResolvedValueOnce(mockResponse(200, { user: { userId: 'u1', username: 'alice' } }))

        const { result } = renderHook(() => useUserQuery(), { wrapper: makeWrapper() })
        await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 5000 })

        expect(mockSetAuthToken).not.toHaveBeenCalled()
    })

    it('strips the token from the data exposed to consumers', async () => {
        mockApiFetch.mockResolvedValueOnce(
            mockResponse(200, { user: { userId: 'u1', username: 'alice' }, token: 'leak.me.not' })
        )

        const { result } = renderHook(() => useUserQuery(), { wrapper: makeWrapper() })
        await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 5000 })

        expect(result.current.data).not.toHaveProperty('token')
    })

    it.each([
        ['empty string', ''],
        ['null', null],
    ])('strips falsy token (%s) without calling setAuthToken', async (_label, falsyToken) => {
        mockApiFetch.mockResolvedValueOnce(
            mockResponse(200, { user: { userId: 'u1', username: 'alice' }, token: falsyToken })
        )

        const { result } = renderHook(() => useUserQuery(), { wrapper: makeWrapper() })
        await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 5000 })

        expect(result.current.data).not.toHaveProperty('token')
        expect(mockSetAuthToken).not.toHaveBeenCalled()
    })

    it('clears the token on 401 (dead JWT) without touching setAuthToken', async () => {
        mockApiFetch.mockResolvedValueOnce(mockResponse(401, null))

        const { result } = renderHook(() => useUserQuery(), { wrapper: makeWrapper() })
        await waitFor(() => expect(result.current.isFetched).toBe(true))

        expect(mockClearAuthToken).toHaveBeenCalledTimes(1)
        expect(mockSetAuthToken).not.toHaveBeenCalled()
    })

    it('clears the token on 404 (user no longer exists)', async () => {
        mockApiFetch.mockResolvedValueOnce(mockResponse(404, null))

        const { result } = renderHook(() => useUserQuery(), { wrapper: makeWrapper() })
        await waitFor(() => expect(result.current.isFetched).toBe(true))

        expect(mockClearAuthToken).toHaveBeenCalledTimes(1)
    })

    it('does NOT clear a token that rotated mid-request (stale 401 racing a fresh login)', async () => {
        const { getAuthToken } = jest.requireMock('@/utils/auth-token')
        // old token at request time, fresh login token by the time the 401 lands
        getAuthToken.mockReturnValueOnce('dead-jwt').mockReturnValue('fresh-jwt')
        mockApiFetch.mockResolvedValueOnce(mockResponse(401, null))
        // the thrown rotation error triggers a tanstack retry — succeed it
        mockApiFetch.mockResolvedValueOnce(mockResponse(200, { user: { userId: 'u1', username: 'alice' } }))

        const { result } = renderHook(() => useUserQuery(), { wrapper: makeWrapper() })
        await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 5000 })

        expect(mockClearAuthToken).not.toHaveBeenCalled()
    })
})

describe('useUserQuery — demo mode', () => {
    // jsdom strips the WebView's global Response; the demo routes build one.
    // Only what fetchUser reads back: ok, status, json().
    class TestResponse {
        status: number
        constructor(
            private body: string,
            init?: { status?: number }
        ) {
            this.status = init?.status ?? 200
        }
        get ok() {
            return this.status >= 200 && this.status < 300
        }
        json() {
            return Promise.resolve(JSON.parse(this.body))
        }
    }
    const originalResponse = global.Response
    beforeAll(() => {
        global.Response = TestResponse as unknown as typeof Response
    })
    afterAll(() => {
        global.Response = originalResponse
        ;(isDemoMode as jest.Mock).mockReturnValue(false)
    })

    it('keeps an avatar picked through the demo routes across a refetch (TASK-22142)', async () => {
        ;(isDemoMode as jest.Mock).mockReturnValue(true)
        const { demoRespond } = await import('@/utils/demo-api')
        await demoRespond('/update-user', {
            method: 'POST',
            body: JSON.stringify({ username: 'demo', avatarKey: 'basic.frog' }),
        })

        const { result } = renderHook(() => useUserQuery(), { wrapper: makeWrapper() })
        await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 5000 })

        // Force a settled round-trip: with demo placeholderData the mount-time
        // fetch's completion never notifies this 5.8.4 harness (placeholder
        // stays on screen); the app path is invalidate→refetch, mirrored here.
        const { data } = await result.current.refetch()

        // the real fetchUser path, through the mutable demo profile, not the
        // static constant (which also serves as placeholderData pre-fetch)
        expect(data?.user.avatarKey).toBe('basic.frog')
    })
})

describe('useUserQuery transient failures', () => {
    it.each([429, 408, 503])('keeps the cached session after HTTP %s', async (status) => {
        const profile = { user: { userId: 'u1', username: 'alice' } }
        mockApiFetch.mockReset()
        mockClearAuthToken.mockClear()
        mockApiFetch.mockResolvedValueOnce(mockResponse(200, profile))
        const { result } = renderHook(() => useUserQuery(), { wrapper: makeWrapper() })
        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        mockApiFetch.mockResolvedValue(mockResponse(status, {}))
        const refreshed = await result.current.refetch()
        expect(refreshed.data).toEqual(profile)
        expect(refreshed.isError).toBe(true)
        expect(mockClearAuthToken).not.toHaveBeenCalled()
    })
})

describe('useUserQuery — login capture dedupe (TASK-22516)', () => {
    const posthogMock = jest.requireMock('posthog-js').default

    beforeEach(() => {
        jest.clearAllMocks()
        mockApiFetch.mockReset()
    })

    const loginCalls = () => posthogMock.capture.mock.calls.filter(([event]: [string]) => event === 'login')

    it('captures login once per PostHog session across refetches', async () => {
        posthogMock.get_session_id.mockReturnValue('ph-session-A')
        mockApiFetch.mockResolvedValue(mockResponse(200, { user: { userId: 'u1', username: 'alice' } }))

        const { result } = renderHook(() => useUserQuery(), { wrapper: makeWrapper() })
        await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 5000 })
        await result.current.refetch()

        expect(loginCalls()).toHaveLength(1)
    })

    it('captures again when the PostHog session changes', async () => {
        posthogMock.get_session_id.mockReturnValue('ph-session-B')
        mockApiFetch.mockResolvedValue(mockResponse(200, { user: { userId: 'u1', username: 'alice' } }))

        const { result } = renderHook(() => useUserQuery(), { wrapper: makeWrapper() })
        await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 5000 })
        expect(loginCalls()).toHaveLength(1)

        posthogMock.get_session_id.mockReturnValue('ph-session-C')
        await result.current.refetch()

        expect(loginCalls()).toHaveLength(2)
    })
})
