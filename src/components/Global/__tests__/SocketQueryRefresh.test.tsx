import { act, render, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { SocketQueryRefresh } from '@/components/Global/SocketQueryRefresh'
import { useWebSocket } from '@/hooks/useWebSocket'
import { useTransactionHistory } from '@/hooks/useTransactionHistory'
import type { HistoryEntry } from '@/hooks/useTransactionHistory'
import { serverFetch } from '@/utils/api-fetch'
import { TRANSACTIONS } from '@/constants/query.consts'

// Fake socket capturing event handlers so tests can push server messages.
const handlers: Record<string, Array<(data: unknown) => void>> = {}
const fakeWs = {
    on: (event: string, cb: (data: unknown) => void) => {
        ;(handlers[event] ??= []).push(cb)
    },
    off: (event: string, cb: (data: unknown) => void) => {
        handlers[event] = (handlers[event] ?? []).filter((h) => h !== cb)
    },
    connect: jest.fn(),
    disconnect: jest.fn(),
}
jest.mock('@/services/websocket', () => ({
    getWebSocketInstance: () => fakeWs,
}))
const mockFetchUser = jest.fn()
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ user: { user: { userId: 'user-1', username: 'alice' } }, fetchUser: mockFetchUser }),
}))
jest.mock('@/hooks/useRainCardOverview', () => ({ RAIN_CARD_OVERVIEW_QUERY_KEY: 'rain-card-overview' }))
jest.mock('@/utils/api-fetch', () => ({ serverFetch: jest.fn() }))
const serverFetchMock = serverFetch as jest.MockedFunction<typeof serverFetch>

function emit(event: string, data: unknown) {
    act(() => {
        handlers[event]?.forEach((cb) => cb(data))
    })
}
const ping = (uuid: string) => ({ uuid, type: 'TRANSACTION_INTENT', status: 'COMPLETED' }) as HistoryEntry

/** A screen's socket listener, as each useWebSocket consumer mounts one. */
function Listener() {
    useWebSocket({ username: 'alice' })
    return null
}

/** The app shell: the one SocketQueryRefresh plus twenty other listeners, as on home. */
function makeApp() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
    const App = ({ children }: { children?: ReactNode }) => (
        <QueryClientProvider client={client}>
            <SocketQueryRefresh />
            {Array.from({ length: 20 }, (_, i) => (
                <Listener key={i} />
            ))}
            {children}
        </QueryClientProvider>
    )
    App.displayName = 'TestApp'
    return { App, client }
}

const settle = () =>
    act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50))
    })

beforeEach(() => {
    for (const key of Object.keys(handlers)) delete handlers[key]
    serverFetchMock.mockReset()
    mockFetchUser.mockReset()
    mockFetchUser.mockResolvedValue(null)
})

describe('SocketQueryRefresh', () => {
    it('answers a ping once however many listeners are mounted', () => {
        const { App, client } = makeApp()
        const invalidateSpy = jest.spyOn(client, 'invalidateQueries')
        render(<App />)

        emit('history_entry', ping('charge-1'))

        expect(invalidateSpy).toHaveBeenCalledTimes(2)
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: [TRANSACTIONS] })
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['balance'] })
    })

    it('refreshes the card overview once per rail or card event', () => {
        const { App, client } = makeApp()
        const invalidateSpy = jest.spyOn(client, 'invalidateQueries')
        render(<App />)

        emit('user_rail_status_changed', { railId: 'r1', status: 'ENABLED' })
        expect(invalidateSpy).toHaveBeenCalledTimes(1)
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['rain-card-overview', 'user-1'] })

        emit('rain_card_balance_changed', { reason: 'auto_balance_deposit' })
        expect(invalidateSpy).toHaveBeenCalledTimes(3)
        expect(invalidateSpy).toHaveBeenLastCalledWith({ queryKey: ['balance'] })
    })

    /**
     * The staging burst of 2026-09-24 13:36Z: ~100 identical first-page
     * requests in half a second from one phone, after one ping.
     */
    it('one ping sends one history request, and a newer ping aborts the one it supersedes', async () => {
        const { App } = makeApp()
        serverFetchMock.mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({ entries: [], hasMore: false }),
        } as Response)

        const { result } = renderHook(() => useTransactionHistory({ mode: 'latest', limit: 10 }), { wrapper: App })
        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        expect(serverFetchMock).toHaveBeenCalledTimes(1)

        // refetches stay in flight, as they did on the slow database
        serverFetchMock.mockReturnValue(new Promise<Response>(() => {}))
        emit('history_entry', ping('charge-1'))
        await settle()
        expect(serverFetchMock).toHaveBeenCalledTimes(2)
        const first = serverFetchMock.mock.calls[1][1]?.signal
        expect(first?.aborted).toBe(false)

        emit('history_entry', ping('charge-2'))
        await settle()
        expect(serverFetchMock).toHaveBeenCalledTimes(3)
        // the superseded request is cancelled, not left open
        expect(first?.aborted).toBe(true)
        expect(serverFetchMock.mock.calls[2][1]?.signal?.aborted).toBe(false)
    })

    describe('user refetch on rail and ToS pushes', () => {
        const railPush = (railId: string) => ({ railId, status: 'ENABLED', provider: 'BRIDGE' })
        const advance = (ms: number) =>
            act(() => {
                jest.advanceTimersByTime(ms)
            })
        const flushPromises = () => act(async () => {})

        beforeEach(() => {
            jest.useFakeTimers()
        })
        afterEach(() => {
            jest.useRealTimers()
        })

        it('one rail push refetches the user once and still refreshes the card overview', async () => {
            const { App, client } = makeApp()
            const invalidateSpy = jest.spyOn(client, 'invalidateQueries')
            render(<App />)

            emit('user_rail_status_changed', railPush('r1'))
            expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['rain-card-overview', 'user-1'] })
            expect(mockFetchUser).not.toHaveBeenCalled()

            advance(499)
            expect(mockFetchUser).not.toHaveBeenCalled()
            advance(1)
            expect(mockFetchUser).toHaveBeenCalledTimes(1)

            await flushPromises()
            advance(5000)
            expect(mockFetchUser).toHaveBeenCalledTimes(1)
        })

        it('three rail pushes inside the window refetch the user once', async () => {
            const { App } = makeApp()
            render(<App />)

            emit('user_rail_status_changed', railPush('r1'))
            advance(200)
            emit('user_rail_status_changed', railPush('r2'))
            advance(200)
            emit('user_rail_status_changed', railPush('r3'))
            advance(100)
            expect(mockFetchUser).toHaveBeenCalledTimes(1)

            await flushPromises()
            advance(5000)
            expect(mockFetchUser).toHaveBeenCalledTimes(1)
        })

        it('a ToS push refetches the user once', async () => {
            // The other listeners log that they have no ToS callback.
            const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
            const { App } = makeApp()
            render(<App />)

            emit('persona_tos_status_update', { status: 'approved' })
            advance(500)
            expect(mockFetchUser).toHaveBeenCalledTimes(1)

            await flushPromises()
            advance(5000)
            expect(mockFetchUser).toHaveBeenCalledTimes(1)
            logSpy.mockRestore()
        })

        it('pushes during a refetch in flight lead to one more refetch after it settles', async () => {
            let settleFirst: (value: null) => void = () => {}
            mockFetchUser.mockReturnValueOnce(
                new Promise<null>((resolve) => {
                    settleFirst = resolve
                })
            )
            const { App } = makeApp()
            render(<App />)

            emit('user_rail_status_changed', railPush('r1'))
            advance(500)
            expect(mockFetchUser).toHaveBeenCalledTimes(1)

            emit('user_rail_status_changed', railPush('r2'))
            advance(500)
            emit('user_rail_status_changed', railPush('r3'))
            advance(500)
            // never two requests at once
            expect(mockFetchUser).toHaveBeenCalledTimes(1)

            settleFirst(null)
            await flushPromises()
            expect(mockFetchUser).toHaveBeenCalledTimes(2)

            await flushPromises()
            advance(5000)
            expect(mockFetchUser).toHaveBeenCalledTimes(2)
        })
    })
})
