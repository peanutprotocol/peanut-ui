import { act, render, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { InvalidateQueryFilters } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { SocketQueryRefresh } from '@/components/Global/SocketQueryRefresh'
import { useWebSocket } from '@/hooks/useWebSocket'
import { useTransactionHistory } from '@/hooks/useTransactionHistory'
import type { HistoryEntry } from '@/hooks/useTransactionHistory'
import { useUserQuery } from '@/hooks/query/user'
import { apiFetch, serverFetch } from '@/utils/api-fetch'
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
const ALICE = { user: { userId: 'user-1', username: 'alice' } }
let mockAuthUser: typeof ALICE | null = ALICE
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ user: mockAuthUser }),
}))
jest.mock('@/hooks/useRainCardOverview', () => ({ RAIN_CARD_OVERVIEW_QUERY_KEY: 'rain-card-overview' }))
jest.mock('@/utils/api-fetch', () => ({ serverFetch: jest.fn(), apiFetch: jest.fn() }))
// The real useUserQuery runs below; these are its collaborators, mocked as in
// hooks/query/__tests__/user.test.tsx.
jest.mock('@/utils/auth-token', () => ({
    setAuthToken: jest.fn(),
    clearAuthToken: jest.fn(),
    getAuthToken: jest.fn(() => null),
    getClearEpoch: jest.fn(() => 0),
}))
jest.mock('@/hooks/useGetDeviceType', () => ({ useDeviceType: () => ({ deviceType: 'desktop' }) }))
jest.mock('posthog-js', () => ({ default: { capture: jest.fn() }, capture: jest.fn() }))
const serverFetchMock = serverFetch as jest.MockedFunction<typeof serverFetch>
const apiFetchMock = apiFetch as jest.MockedFunction<typeof apiFetch>

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
    mockAuthUser = ALICE
})

describe('SocketQueryRefresh', () => {
    it('answers a ping once however many listeners are mounted', () => {
        const { App, client } = makeApp()
        const invalidateSpy = jest.spyOn(client, 'invalidateQueries')
        render(<App />)

        emit('history_entry', ping('charge-1'))

        expect(invalidateSpy).toHaveBeenCalledTimes(3)
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['request-fulfillment'] })
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: [TRANSACTIONS] })
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['balance'] })
    })

    it('refreshes the card overview at once on a card balance event', () => {
        const { App, client } = makeApp()
        const invalidateSpy = jest.spyOn(client, 'invalidateQueries')
        render(<App />)

        emit('rain_card_balance_changed', { reason: 'auto_balance_deposit' })
        expect(invalidateSpy).toHaveBeenCalledTimes(2)
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['rain-card-overview', 'user-1'] })
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

    describe('rail and ToS pushes', () => {
        /** The user query as AuthProvider mounts it; `enabled={false}` is the app lock. */
        function UserQuery({ enabled = true }: { enabled?: boolean }) {
            useUserQuery(enabled)
            return null
        }

        const railPush = (railId: string) => ({ railId, status: 'ENABLED', provider: 'BRIDGE' })
        const usersMeRequests = () => apiFetchMock.mock.calls.filter(([path]) => path === '/users/me').length
        const isRainOverviewKey = (filters?: InvalidateQueryFilters) => filters?.queryKey?.[0] === 'rain-card-overview'
        const advance = (ms: number) =>
            act(async () => {
                await jest.advanceTimersByTimeAsync(ms)
            })

        /** Mounts the app with the user loaded, as it is once the socket connects. */
        async function mountWithUser() {
            const { App, client } = makeApp()
            const view = render(
                <App>
                    <UserQuery />
                </App>
            )
            await advance(0)
            expect(usersMeRequests()).toBe(1)
            const invalidateSpy = jest.spyOn(client, 'invalidateQueries')
            const rainOverviewInvalidations = () =>
                invalidateSpy.mock.calls.filter(([filters]) => isRainOverviewKey(filters)).length
            return { App, client, view, rainOverviewInvalidations }
        }

        beforeEach(() => {
            jest.useFakeTimers()
            apiFetchMock.mockReset()
            apiFetchMock.mockImplementation(async () => {
                const status = mockAuthUser ? 200 : 401
                return { ok: status === 200, status, json: async () => mockAuthUser } as Response
            })
        })
        afterEach(() => {
            jest.useRealTimers()
        })

        it('one rail push reads the user once, 500 ms later, with the card overview', async () => {
            const { rainOverviewInvalidations } = await mountWithUser()

            emit('user_rail_status_changed', railPush('r1'))
            await advance(499)
            expect(usersMeRequests()).toBe(1)
            expect(rainOverviewInvalidations()).toBe(0)

            await advance(1)
            expect(usersMeRequests()).toBe(2)
            expect(rainOverviewInvalidations()).toBe(1)

            await advance(5000)
            expect(usersMeRequests()).toBe(2)
            expect(rainOverviewInvalidations()).toBe(1)
        })

        it('three rail pushes inside the window read the user once', async () => {
            const { rainOverviewInvalidations } = await mountWithUser()

            emit('user_rail_status_changed', railPush('r1'))
            await advance(200)
            emit('user_rail_status_changed', railPush('r2'))
            await advance(200)
            emit('user_rail_status_changed', railPush('r3'))
            await advance(100)
            expect(usersMeRequests()).toBe(2)
            expect(rainOverviewInvalidations()).toBe(1)

            await advance(5000)
            expect(usersMeRequests()).toBe(2)
            expect(rainOverviewInvalidations()).toBe(1)
        })

        it('a ToS push reads the user once', async () => {
            // The other listeners log that they have no ToS callback.
            const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
            const { rainOverviewInvalidations } = await mountWithUser()

            emit('persona_tos_status_update', { status: 'approved' })
            await advance(500)
            expect(usersMeRequests()).toBe(2)
            expect(rainOverviewInvalidations()).toBe(1)

            await advance(5000)
            expect(usersMeRequests()).toBe(2)
            logSpy.mockRestore()
        })

        it('a read still in flight when the window closes is restarted, not joined', async () => {
            await mountWithUser()
            apiFetchMock.mockImplementationOnce(() => new Promise<Response>(() => {}))

            emit('user_rail_status_changed', railPush('r1'))
            await advance(500)
            expect(usersMeRequests()).toBe(2)
            const first = apiFetchMock.mock.calls[1][1]?.signal
            expect(first?.aborted).toBe(false)

            emit('user_rail_status_changed', railPush('r2'))
            await advance(500)
            expect(usersMeRequests()).toBe(3)
            // it may have read the user before the second push
            expect(first?.aborted).toBe(true)
        })

        it('while the app lock disables the user query, a push reads nothing until unlock', async () => {
            const { App, view } = await mountWithUser()

            // control: locking and unlocking alone does not read the fresh user
            view.rerender(
                <App>
                    <UserQuery enabled={false} />
                </App>
            )
            view.rerender(
                <App>
                    <UserQuery />
                </App>
            )
            await advance(0)
            expect(usersMeRequests()).toBe(1)

            view.rerender(
                <App>
                    <UserQuery enabled={false} />
                </App>
            )
            emit('user_rail_status_changed', railPush('r1'))
            await advance(500)
            expect(usersMeRequests()).toBe(1)

            view.rerender(
                <App>
                    <UserQuery />
                </App>
            )
            await advance(0)
            expect(usersMeRequests()).toBe(2)
        })

        it('a push just before logout reads nothing after the session is cleared', async () => {
            // The logged-out read answers 401, and useUserQuery warns about it.
            const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
            const { App, client, view } = await mountWithUser()

            emit('user_rail_status_changed', railPush('r1'))
            await advance(100)

            mockAuthUser = null
            act(() => {
                client.clear()
            })
            view.rerender(
                <App>
                    <UserQuery />
                </App>
            )
            await advance(0)
            // the user query reads once by itself after the clear, as in the app
            expect(usersMeRequests()).toBe(2)

            await advance(1000)
            expect(usersMeRequests()).toBe(2)
            warnSpy.mockRestore()
        })
    })
})

it('refreshes request fulfillment once for a typed payment push or reconnect', () => {
    const { App, client } = makeApp()
    const invalidate = jest.spyOn(client, 'invalidateQueries')
    render(<App />)
    emit('history_entry', { ...ping('paid'), extraData: { kind: 'P2P_REQUEST_FULFILL' }, status: 'COMPLETED' })
    expect(invalidate).toHaveBeenCalledTimes(1)
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['request-fulfillment'] })
    invalidate.mockClear()
    emit('connect', undefined)
    expect(invalidate).toHaveBeenCalledTimes(1)
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['request-fulfillment'] })
})
