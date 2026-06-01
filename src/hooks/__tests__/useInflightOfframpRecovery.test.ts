import { renderHook, act, waitFor } from '@testing-library/react'
import { useInflightOfframpRecovery } from '@/hooks/useInflightOfframpRecovery'
import { getOfframpByTxHash } from '@/app/actions/offramp'

jest.mock('@/app/actions/offramp', () => ({
    getOfframpByTxHash: jest.fn(),
}))

const mockedGetOfframpByTxHash = getOfframpByTxHash as jest.MockedFunction<typeof getOfframpByTxHash>

const STORAGE_KEY = 'peanut.inflightOfframps.v1'

const makeBeState = (overrides: Partial<Awaited<ReturnType<typeof getOfframpByTxHash>>> = {}) => ({
    intentId: 'intent-1',
    transferId: 't-1',
    status: 'PENDING',
    bridgeState: 'AWAITING_FUNDS',
    userSubmittedTxHash: '0xabc',
    updatedAt: '2026-06-01T14:00:00Z',
    ...overrides,
})

beforeEach(() => {
    window.localStorage.clear()
    mockedGetOfframpByTxHash.mockReset()
})

describe('useInflightOfframpRecovery', () => {
    test('fresh mount with no localStorage entries: inflightTxHash stays null and skips BE query', async () => {
        const { result } = renderHook(() => useInflightOfframpRecovery())
        await waitFor(() => expect(result.current.isRecovering).toBe(false))
        expect(result.current.inflightTxHash).toBeNull()
        expect(mockedGetOfframpByTxHash).not.toHaveBeenCalled()
    })

    test('markSubmitted persists to localStorage and exposes the hash', () => {
        const { result } = renderHook(() => useInflightOfframpRecovery())
        act(() => result.current.markSubmitted('t-1', '0xaaa'))
        expect(result.current.inflightTxHash).toBe('0xaaa')
        const raw = window.localStorage.getItem(STORAGE_KEY)
        expect(raw).not.toBeNull()
        const parsed = JSON.parse(raw!)
        expect(parsed).toHaveLength(1)
        expect(parsed[0]).toMatchObject({ transferId: 't-1', txHash: '0xaaa' })
        expect(typeof parsed[0].submittedAt).toBe('number')
    })

    test('on mount: recovers stored hash when BE confirms it (Konrad reload scenario)', async () => {
        // The motivating case: user submitted, on-chain leg fired, confirm
        // timed out, app was closed. Next session must restore the gate so
        // the user can't re-trigger sendMoney().
        window.localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify([{ transferId: 't-1', txHash: '0xaaa', submittedAt: Date.now() }])
        )
        mockedGetOfframpByTxHash.mockResolvedValueOnce(makeBeState({ userSubmittedTxHash: '0xaaa' }))

        const { result } = renderHook(() => useInflightOfframpRecovery())
        await waitFor(() => expect(result.current.isRecovering).toBe(false))
        expect(result.current.inflightTxHash).toBe('0xaaa')
        expect(mockedGetOfframpByTxHash).toHaveBeenCalledWith('0xaaa')
    })

    test('BE returns null (404): entry is pruned and form renders normally', async () => {
        // The on-chain leg never actually fired (or BE never saw the hash).
        // Safe to clear so the user gets a fresh form next visit.
        window.localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify([{ transferId: 't-1', txHash: '0xaaa', submittedAt: Date.now() }])
        )
        mockedGetOfframpByTxHash.mockResolvedValueOnce(null)

        const { result } = renderHook(() => useInflightOfframpRecovery())
        await waitFor(() => expect(result.current.isRecovering).toBe(false))
        expect(result.current.inflightTxHash).toBeNull()
        expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY)!)).toHaveLength(0)
    })

    test('clearInflight removes the entry and reverts the hash', () => {
        const { result } = renderHook(() => useInflightOfframpRecovery())
        act(() => result.current.markSubmitted('t-1', '0xaaa'))
        expect(result.current.inflightTxHash).toBe('0xaaa')
        act(() => result.current.clearInflight('t-1'))
        expect(result.current.inflightTxHash).toBeNull()
        expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY)!)).toHaveLength(0)
    })

    test('entries older than 24h are pruned on mount without hitting BE', async () => {
        const twentyFiveHoursAgo = Date.now() - 25 * 60 * 60 * 1000
        window.localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify([{ transferId: 't-stale', txHash: '0xold', submittedAt: twentyFiveHoursAgo }])
        )
        const { result } = renderHook(() => useInflightOfframpRecovery())
        await waitFor(() => expect(result.current.isRecovering).toBe(false))
        expect(result.current.inflightTxHash).toBeNull()
        expect(mockedGetOfframpByTxHash).not.toHaveBeenCalled()
        expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY)!)).toHaveLength(0)
    })

    test('multiple entries: restores the most recent that BE confirms', async () => {
        const now = Date.now()
        window.localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify([
                { transferId: 't-old', txHash: '0xold', submittedAt: now - 60_000 },
                { transferId: 't-new', txHash: '0xnew', submittedAt: now - 1_000 },
            ])
        )
        mockedGetOfframpByTxHash.mockResolvedValueOnce(makeBeState({ userSubmittedTxHash: '0xnew' }))

        const { result } = renderHook(() => useInflightOfframpRecovery())
        await waitFor(() => expect(result.current.isRecovering).toBe(false))
        expect(result.current.inflightTxHash).toBe('0xnew')
        // Most recent queried first; first match wins, older entry not queried.
        expect(mockedGetOfframpByTxHash).toHaveBeenCalledTimes(1)
        expect(mockedGetOfframpByTxHash).toHaveBeenCalledWith('0xnew')
    })

    test('corrupted localStorage is tolerated (does not throw)', async () => {
        window.localStorage.setItem(STORAGE_KEY, '{ not valid json')
        const { result } = renderHook(() => useInflightOfframpRecovery())
        await waitFor(() => expect(result.current.isRecovering).toBe(false))
        expect(result.current.inflightTxHash).toBeNull()
    })
})
