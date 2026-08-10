import { act, renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useWebSocket } from '@/hooks/useWebSocket'
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
