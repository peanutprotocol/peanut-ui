import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useHistoryEntry } from '@/hooks/useHistoryEntry'
import { apiFetch } from '@/utils/api-fetch'
import { isSettling, type HistoryEntry } from '@/utils/history.utils'

jest.mock('@/utils/api-fetch', () => ({ apiFetch: jest.fn() }))
jest.mock('@/assets/payment-apps', () => ({ MERCADO_PAGO: '', PIX: '' }))

const mockApiFetch = apiFetch as jest.Mock

const NOW = Date.parse('2026-10-22T12:00:00.000Z')
const minutesAgo = (minutes: number) => new Date(NOW - minutes * 60_000).toISOString()

const entry = (
    status: string,
    completedAt?: string,
    networkFeeStatus?: 'pending' | 'settled' | 'unknown'
): Pick<HistoryEntry, 'status' | 'completedAt' | 'extraData'> =>
    ({
        status,
        completedAt,
        extraData: { kind: 'CRYPTO_WITHDRAW', networkFeeStatus },
    }) as Pick<HistoryEntry, 'status' | 'completedAt' | 'extraData'>

describe('isSettling', () => {
    it.each([
        ['a pending row', entry('PENDING'), true],
        ['a processing row', entry('PROCESSING', undefined, 'pending'), true],
        ['a completed row with a settled fee', entry('COMPLETED', minutesAgo(1), 'settled'), false],
        ['a completed row with an unknown fee', entry('COMPLETED', minutesAgo(1), 'unknown'), false],
        ['a completed row of another kind (no fee status)', entry('COMPLETED', minutesAgo(1)), false],
        ['a completed row whose fee is pending, 1 minute in', entry('COMPLETED', minutesAgo(1), 'pending'), true],
        ['a completed row whose fee is pending, 9 minutes in', entry('COMPLETED', minutesAgo(9), 'pending'), true],
        // some legacy routes never report the delivery: stop asking
        ['a completed row whose fee is pending, 10 minutes in', entry('COMPLETED', minutesAgo(10), 'pending'), false],
        ['a completed row whose fee is pending, no completion date', entry('COMPLETED', undefined, 'pending'), false],
        ['a completed row whose fee is pending, unreadable date', entry('COMPLETED', 'not-a-date', 'pending'), false],
    ])('%s → %s', (_name, value, expected) => {
        expect(isSettling(value, NOW)).toBe(expected)
    })
})

function wrapper({ children }: { children: ReactNode }) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

describe('useHistoryEntry', () => {
    beforeEach(() => {
        mockApiFetch.mockReset()
        mockApiFetch.mockResolvedValue({
            ok: true,
            json: () =>
                Promise.resolve({
                    uuid: 'intent-1',
                    type: 'TRANSACTION_INTENT',
                    timestamp: '2026-10-22T11:59:00.000Z',
                    amount: '64.5',
                    status: 'COMPLETED',
                    extraData: { kind: 'CRYPTO_WITHDRAW', networkFeeStatus: 'settled', networkFeeUsd: 1.43 },
                }),
        })
    })

    it('reads the entry by id and kind', async () => {
        const { result } = renderHook(() => useHistoryEntry('intent-1', 'CRYPTO_WITHDRAW'), { wrapper })

        await waitFor(() => expect(result.current.data).toBeDefined())
        expect(mockApiFetch).toHaveBeenCalledWith('/history/intent-1?kind=CRYPTO_WITHDRAW')
        expect(result.current.data?.extraData?.networkFeeUsd).toBe(1.43)
    })

    it('does not read when disabled, or without an id or a kind', () => {
        renderHook(() => useHistoryEntry('intent-1', 'CRYPTO_WITHDRAW', { enabled: false }), { wrapper })
        renderHook(() => useHistoryEntry(undefined, 'CRYPTO_WITHDRAW'), { wrapper })
        renderHook(() => useHistoryEntry('intent-1', undefined), { wrapper })

        expect(mockApiFetch).not.toHaveBeenCalled()
    })
})
