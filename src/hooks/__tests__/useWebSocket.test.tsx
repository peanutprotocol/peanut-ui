import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useWebSocket } from '@/hooks/useWebSocket'
import { useTransactionHistory } from '@/hooks/useTransactionHistory'
import { serverFetch } from '@/utils/api-fetch'
import { TRANSACTIONS } from '@/constants/query.consts'
import type { HistoryEntry } from '@/hooks/useTransactionHistory'
import type { ReactNode } from 'react'

// Fake socket capturing event handlers so tests can push server messages.
const handlers: Record<string, Array<(data: unknown) => void>> = {}
const fakeWs = {
    on: (event: string, cb: (data: unknown) => void) => {
        ;(handlers[event] ??= []).push(cb)
    },
    off: jest.fn(),
    connect: jest.fn(),
    disconnect: jest.fn(),
}
jest.mock('@/services/websocket', () => ({
    getWebSocketInstance: () => fakeWs,
}))
jest.mock('@/utils/api-fetch', () => ({
    serverFetch: jest.fn(),
}))
const serverFetchMock = serverFetch as jest.MockedFunction<typeof serverFetch>

function emitHistoryEntry(entry: Partial<HistoryEntry>) {
    act(() => {
        handlers['history_entry']?.forEach((cb) => cb(entry))
    })
}

function makeWrapper() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
    const Wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
    )
    Wrapper.displayName = 'TestQueryClientWrapper'
    return { wrapper: Wrapper, client }
}

describe('useWebSocket — history_entry handling', () => {
    beforeEach(() => {
        for (const key of Object.keys(handlers)) delete handlers[key]
    })

    /**
     * The snapshots are overlaid on the fetched rows, so one the refetch drops
     * kept rendering from memory: a watcher-first deposit that adoption later
     * cancels stayed in the home list after REST had correctly stopped
     * returning it. The kindless ping is the authoritative "ask again", so its
     * answer wins over anything held locally.
     */
    it('kindless ping clears the snapshots it supersedes, so the refetched rows win', () => {
        const { wrapper, client } = makeWrapper()
        const invalidateSpy = jest.spyOn(client, 'invalidateQueries')

        const { result } = renderHook(() => useWebSocket({ username: 'alice' }), { wrapper })

        emitHistoryEntry({
            uuid: 'watcher-deposit',
            type: 'TRANSACTION_INTENT',
            status: 'PENDING',
            extraData: { kind: 'CRYPTO_DEPOSIT' },
        } as unknown as HistoryEntry)
        expect(result.current.historyEntries.map((e) => e.uuid)).toEqual(['watcher-deposit'])

        emitHistoryEntry({ uuid: 'watcher-deposit', type: 'TRANSACTION_INTENT', status: 'CANCELLED' } as HistoryEntry)

        expect(result.current.historyEntries).toHaveLength(0)
        // nothing is lost by dropping them: the same ping asks for the rows
        // again, and whatever REST still returns comes back with the answer
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: [TRANSACTIONS] })
    })

    // Regression for the "Sent to Transaction $0.00" flash (PEANUT-UI-QCW):
    // charge completions arrive as minimal {uuid, status} pings with no
    // extraData — the BE expects a refetch. Rendering one routes the
    // transformer to its fallback strategy (name "Transaction", amount 0).
    it('kindless charge ping is not rendered — it invalidates the transactions query instead', () => {
        const { wrapper, client } = makeWrapper()
        const invalidateSpy = jest.spyOn(client, 'invalidateQueries')
        const onHistoryEntry = jest.fn()

        const { result } = renderHook(() => useWebSocket({ username: 'alice', onHistoryEntry }), { wrapper })

        emitHistoryEntry({ uuid: 'charge-1', type: 'TRANSACTION_INTENT', status: 'COMPLETED' } as HistoryEntry)

        expect(result.current.historyEntries).toHaveLength(0)
        expect(onHistoryEntry).not.toHaveBeenCalled()
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: [TRANSACTIONS] })
        // Charge completions move balance; the ping must refresh it since the
        // per-page callbacks (which used to) no longer see kindless entries.
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['balance'] })
    })

    it('full entry with a kind is surfaced to state and the callback', () => {
        const { wrapper, client } = makeWrapper()
        const invalidateSpy = jest.spyOn(client, 'invalidateQueries')
        const onHistoryEntry = jest.fn()

        const { result } = renderHook(() => useWebSocket({ username: 'alice', onHistoryEntry }), { wrapper })

        const entry = {
            uuid: 'dep-1',
            type: 'TRANSACTION_INTENT',
            status: 'COMPLETED',
            amount: '200.00',
            extraData: { kind: 'CRYPTO_DEPOSIT' },
        } as unknown as HistoryEntry

        emitHistoryEntry(entry)

        expect(result.current.historyEntries).toEqual([entry])
        expect(onHistoryEntry).toHaveBeenCalledWith(entry)
        expect(invalidateSpy).not.toHaveBeenCalled()
    })

    it('pending request entries (NEW, no senderAccount) are still ignored', () => {
        const { wrapper } = makeWrapper()
        const onHistoryEntry = jest.fn()

        const { result } = renderHook(() => useWebSocket({ username: 'alice', onHistoryEntry }), { wrapper })

        emitHistoryEntry({
            uuid: 'req-1',
            type: 'TRANSACTION_INTENT',
            status: 'NEW',
            extraData: { kind: 'DIRECT_TRANSFER' },
        } as unknown as HistoryEntry)

        expect(result.current.historyEntries).toHaveLength(0)
        expect(onHistoryEntry).not.toHaveBeenCalled()
    })
})

describe('useWebSocket — one kindless ping, one refetch', () => {
    beforeEach(() => {
        for (const key of Object.keys(handlers)) delete handlers[key]
        serverFetchMock.mockReset()
    })

    it('invalidates once however many instances are mounted', () => {
        const { wrapper, client } = makeWrapper()
        const invalidateSpy = jest.spyOn(client, 'invalidateQueries')

        renderHook(
            () => {
                useWebSocket({ username: 'alice' })
                useWebSocket({ username: 'alice' })
                useWebSocket({ username: 'alice' })
            },
            { wrapper }
        )

        emitHistoryEntry({ uuid: 'charge-1', type: 'TRANSACTION_INTENT', status: 'COMPLETED' } as HistoryEntry)

        expect(invalidateSpy).toHaveBeenCalledTimes(2)
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: [TRANSACTIONS] })
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['balance'] })

        // a later ping is a new event and still asks again
        emitHistoryEntry({ uuid: 'charge-2', type: 'TRANSACTION_INTENT', status: 'COMPLETED' } as HistoryEntry)
        expect(invalidateSpy).toHaveBeenCalledTimes(4)
    })

    /**
     * The staging burst of 2026-09-24 13:36Z: ~100 identical first-page
     * requests in half a second from one phone. Each mounted instance
     * invalidated, each invalidation restarted the in-flight fetch, and the
     * fetch does not honour the abort, so every restart was a new request.
     */
    it('one ping sends one history request, not one per mounted instance', async () => {
        const { wrapper } = makeWrapper()
        const page = { entries: [], hasMore: false }
        serverFetchMock.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(page) } as Response)

        // twenty components that each hold a socket listener, as useWallet's
        // consumers do on home
        const Listener = () => {
            useWebSocket({ username: 'alice' })
            return null
        }
        const Screen = ({ children }: { children: ReactNode }) =>
            wrapper({
                children: (
                    <>
                        {Array.from({ length: 20 }, (_, i) => (
                            <Listener key={i} />
                        ))}
                        {children}
                    </>
                ),
            })

        const { result } = renderHook(() => useTransactionHistory({ mode: 'latest', limit: 10 }), {
            wrapper: Screen,
        })
        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        expect(serverFetchMock).toHaveBeenCalledTimes(1)

        // the refetch stays in flight while the ping fans out, as it did on
        // the slow database
        serverFetchMock.mockReturnValue(new Promise<Response>(() => {}))
        emitHistoryEntry({ uuid: 'charge-1', type: 'TRANSACTION_INTENT', status: 'COMPLETED' } as HistoryEntry)

        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 50))
        })
        expect(serverFetchMock).toHaveBeenCalledTimes(2)
        expect(serverFetchMock.mock.calls[1][0]).toBe('/users/history?limit=50')
    })
})
