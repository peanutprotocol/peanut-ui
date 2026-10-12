import { renderHook, waitFor } from '@testing-library/react'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useRainCardOverview } from '@/hooks/useRainCardOverview'
import { rainApi } from '@/services/rain'
import { ApiError } from '@/services/api-error'

jest.mock('@/services/rain', () => ({ rainApi: { getOverview: jest.fn() } }))
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ user: { user: { userId: 'user-1' } } }) }))

const getOverview = rainApi.getOverview as jest.Mock

function render() {
    const client = new QueryClient({ defaultOptions: { queries: { gcTime: 0, retryDelay: 0 } } })
    const wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(QueryClientProvider, { client }, children)
    const hook = renderHook(() => useRainCardOverview(), { wrapper })
    return { ...hook, client }
}

describe('useRainCardOverview polling', () => {
    beforeEach(() => {
        jest.useFakeTimers()
        getOverview.mockReset()
    })

    afterEach(() => jest.useRealTimers())

    it('stops polling once the session is rejected', async () => {
        getOverview.mockRejectedValue(new ApiError('Unauthorized', { status: 401 }))
        const { result, client } = render()
        await waitFor(() => expect(result.current.error).toBeTruthy())
        const callsAfterFailure = getOverview.mock.calls.length

        await jest.advanceTimersByTimeAsync(120_000)
        expect(getOverview).toHaveBeenCalledTimes(callsAfterFailure)
        client.clear()
    })

    it('keeps polling a card holder through other failures', async () => {
        getOverview.mockRejectedValue(new ApiError('Service unavailable', { status: 503 }))
        const { result, client } = render()
        await waitFor(() => expect(result.current.error).toBeTruthy())
        const callsAfterFailure = getOverview.mock.calls.length

        await jest.advanceTimersByTimeAsync(31_000)
        expect(getOverview.mock.calls.length).toBeGreaterThan(callsAfterFailure)
        client.clear()
    })
})
