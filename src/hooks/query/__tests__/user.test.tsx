import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { useUserQuery } from '../user'
import { apiFetch } from '@/utils/api-fetch'
import { setAuthToken, clearAuthToken } from '@/utils/auth-token'

jest.mock('@/utils/api-fetch', () => ({ apiFetch: jest.fn() }))
jest.mock('@/utils/auth-token', () => ({
    setAuthToken: jest.fn(),
    clearAuthToken: jest.fn(),
    getClearEpoch: jest.fn(() => 0),
}))
jest.mock('@/hooks/usePWAStatus', () => ({ usePWAStatus: () => false }))
jest.mock('@/hooks/useGetDeviceType', () => ({ useDeviceType: () => ({ deviceType: 'desktop' }) }))
jest.mock('@/redux/hooks', () => ({
    useAppDispatch: () => jest.fn(),
    useUserStore: () => ({ user: null }),
}))
jest.mock('posthog-js', () => ({ default: { capture: jest.fn() }, capture: jest.fn() }))

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
    })

    it('calls setAuthToken when the response includes a refreshed token', async () => {
        const refreshed = 'new.jwt.token'
        mockApiFetch.mockResolvedValueOnce(
            mockResponse(200, { user: { userId: 'u1', username: 'alice' }, token: refreshed })
        )

        const { result } = renderHook(() => useUserQuery(), { wrapper: makeWrapper() })
        await waitFor(() => expect(result.current.isSuccess).toBe(true))

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

        const { result } = renderHook(() => useUserQuery(), { wrapper: makeWrapper() })
        await waitFor(() => expect(result.current.isSuccess).toBe(true))

        expect(mockSetAuthToken).not.toHaveBeenCalled()
        expect(result.current.data).not.toHaveProperty('token')
    })

    it('does NOT call setAuthToken when the response has no token field', async () => {
        mockApiFetch.mockResolvedValueOnce(mockResponse(200, { user: { userId: 'u1', username: 'alice' } }))

        const { result } = renderHook(() => useUserQuery(), { wrapper: makeWrapper() })
        await waitFor(() => expect(result.current.isSuccess).toBe(true))

        expect(mockSetAuthToken).not.toHaveBeenCalled()
    })

    it('strips the token from the data exposed to consumers', async () => {
        mockApiFetch.mockResolvedValueOnce(
            mockResponse(200, { user: { userId: 'u1', username: 'alice' }, token: 'leak.me.not' })
        )

        const { result } = renderHook(() => useUserQuery(), { wrapper: makeWrapper() })
        await waitFor(() => expect(result.current.isSuccess).toBe(true))

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
        await waitFor(() => expect(result.current.isSuccess).toBe(true))

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
})
