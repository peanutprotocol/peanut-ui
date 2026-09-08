import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useCryptoDepositPolling } from '../useCryptoDepositPolling'
import { rhinoApi } from '@/services/rhino'
import { serverFetch } from '@/utils/api-fetch'

jest.mock('@/utils/api-fetch', () => ({ serverFetch: jest.fn() }))
const mockFetch = jest.mocked(serverFetch)
const response = (status: number, data: unknown) =>
    ({ status, ok: status === 200, statusText: String(status), json: async () => data }) as Response

let client: QueryClient
beforeEach(() => {
    jest.useFakeTimers()
    mockFetch.mockReset()
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
})
afterEach(() => {
    client.clear()
    jest.useRealTimers()
})

const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
)

test('reset clears failed data, accepts absent status and resumes polling through completion', async () => {
    let status = 'failed'
    mockFetch.mockImplementation(async (_url, options) => {
        if (options?.method === 'POST') {
            status = 'absent'
            return response(200, { message: 'Status reset successfully' })
        }
        return status === 'absent'
            ? response(404, { error: 'No update found for given deposit address' })
            : response(200, { status, amount: status === 'completed' ? 5 : undefined })
    })
    const onSuccess = jest.fn()
    const { result } = renderHook(() => useCryptoDepositPolling('sda-test', onSuccess), { wrapper })
    await act(async () => {
        await jest.advanceTimersByTimeAsync(15_100)
    })
    await waitFor(() => expect(result.current.status).toBe('failed'))
    await act(async () => {
        await result.current.resetStatus()
        await jest.advanceTimersByTimeAsync(100)
    })
    expect(result.current.status).toBe('not_started')
    await act(async () => {
        await result.current.resetStatus()
        await jest.advanceTimersByTimeAsync(100)
    })
    status = 'pending'
    await act(async () => {
        await jest.advanceTimersByTimeAsync(5_100)
    })
    await waitFor(() => expect(result.current.status).toBe('loading'))
    status = 'completed'
    await act(async () => {
        await jest.advanceTimersByTimeAsync(5_100)
    })
    await waitFor(() => expect(result.current.status).toBe('completed'))
    expect(onSuccess).toHaveBeenCalledTimes(1)
    await act(async () => {
        await jest.advanceTimersByTimeAsync(10_100)
    })
    expect(onSuccess).toHaveBeenCalledTimes(1)
})

test.each([404, 500])('does not treat unrelated HTTP %s errors as an absent deposit', async (status) => {
    mockFetch.mockResolvedValue(response(status, { error: 'Unexpected upstream error' }))
    await expect(rhinoApi.getDepositAddressStatus('sda-test')).rejects.toThrow('Failed to fetch deposit address status')
})

test('a rejected reset retains the failed state for another attempt', async () => {
    mockFetch.mockImplementation(async (_url, options) =>
        options?.method === 'POST' ? response(500, { error: 'Reset failed' }) : response(200, { status: 'failed' })
    )
    const { result } = renderHook(() => useCryptoDepositPolling('sda-test', jest.fn()), { wrapper })
    await act(async () => {
        await jest.advanceTimersByTimeAsync(15_100)
    })
    await act(async () => {
        await expect(result.current.resetStatus()).rejects.toThrow()
    })
    expect(result.current.status).toBe('failed')
    expect(result.current.isResetting).toBe(false)
})
