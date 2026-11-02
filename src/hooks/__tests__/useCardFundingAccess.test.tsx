/** @jest-environment jsdom */
// An API without managed funding exposes the legacy path only for route absence.
// main (api 7cfbe1701) has no GET /rain/cards/funding/access route, so Fastify
// answers its default route-not-found 404. main still answers POST /rain/cards
// with `terms-required`, so the terms screen waits on this decision.
jest.mock('@/utils/native-platform', () => require('@/test-utils/native-platform-mock').createNativePlatformMock())

import { type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { useCardFundingAccess } from '@/hooks/useCardFundingAccess'

const mockedApiFetch = jest.fn()
jest.mock('@/utils/api-fetch', () => ({ apiFetch: (...args: unknown[]) => mockedApiFetch(...args) }))
jest.mock('@/utils/auth-token', () => ({ getAuthToken: () => 'jwt-abc' }))
jest.mock('@/utils/capacitor', () => ({ isCapacitor: () => false }))
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ user: { user: { userId: 'user-1' } } }) }))
jest.mock('@/hooks/useZeroDev', () => ({ useZeroDev: () => ({ address: '0xabc' }) }))

// Fastify's default not-found body, as main's API sends it for an unknown route.
const routeNotFound = {
    ok: false,
    status: 404,
    json: async () => ({
        message: 'Route GET:/rain/cards/funding/access not found',
        error: 'Not Found',
        statusCode: 404,
    }),
    text: async () => '',
} as unknown as Response

const wrapper = ({ children }: { children: ReactNode }) => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

describe('funding access distinguishes an absent route from an unknown decision', () => {
    beforeEach(() => mockedApiFetch.mockReset())

    it('only a 404 selects legacy enrollment, including an explicit refetch', async () => {
        mockedApiFetch.mockResolvedValue(routeNotFound)
        const { result } = renderHook(() => useCardFundingAccess(), { wrapper })
        await waitFor(() => expect(result.current.isLoading).toBe(false))
        expect(mockedApiFetch).toHaveBeenCalledWith('/rain/cards/funding/access', expect.anything())
        expect(result.current.setupPath).toBe('legacy')
        expect(result.current.access).toMatchObject({ enrollmentAllowed: false })
        expect(result.current.error).toBeNull()
        await act(async () => {
            await result.current.refetch()
        })
        expect(result.current.setupPath).toBe('legacy')
        expect(result.current.access).toMatchObject({ enrollmentAllowed: false })
    })

    it.each([409, 503])('HTTP %i keeps the funding decision unknown', async (status) => {
        mockedApiFetch.mockResolvedValue({
            ok: false,
            status,
            json: async () => ({ error: 'Unavailable' }),
            text: async () => '',
        })
        const { result } = renderHook(() => useCardFundingAccess(), { wrapper })
        await waitFor(() => expect(result.current.isLoading).toBe(false))
        expect(result.current.setupPath).toBeUndefined()
        expect(result.current.access).toBeUndefined()
        expect(result.current.error).toBeTruthy()
    })

    it('a network failure keeps the funding decision unknown', async () => {
        mockedApiFetch.mockRejectedValue(new TypeError('Failed to fetch'))
        const { result } = renderHook(() => useCardFundingAccess(), { wrapper })
        await waitFor(() => expect(result.current.isLoading).toBe(false))
        expect(result.current.setupPath).toBeUndefined()
        expect(result.current.access).toBeUndefined()
        expect(result.current.error).toBeTruthy()
    })
})
