import React from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useRedirectQrStatus } from '../useRedirectQrStatus'
import { serverFetch } from '@/utils/api-fetch'

jest.mock('@/utils/api-fetch', () => ({ serverFetch: jest.fn() }))
const fetch = jest.mocked(serverFetch)
const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        {children}
    </QueryClientProvider>
)

afterEach(() => jest.clearAllMocks())
it('keeps the exact lookup while opting into private transport reporting', async () => {
    const data = { claimed: false, available: true, redirectUrl: '/claim#p=secret' }
    fetch.mockResolvedValue({ ok: true, json: async () => data } as Response)
    const { result } = renderHook(() => useRedirectQrStatus('CaseSensitiveCode'), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(fetch).toHaveBeenCalledWith('/qr/CaseSensitiveCode', { method: 'GET', redactTelemetry: true })
    expect(result.current.data).toEqual(data)
})
it('does not copy an echoed private code into the query error', async () => {
    fetch.mockResolvedValue({ ok: false, json: async () => ({ message: 'private-code' }) } as Response)
    const { result } = renderHook(() => useRedirectQrStatus('private-code'), { wrapper })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toEqual(new Error('Failed to fetch redirect QR status'))
})
