import { act, renderHook } from '@testing-library/react'
import { useWaitingOnProviderModal } from '@/hooks/useWaitingOnProviderModal'
import type { GateState } from '@/utils/capability-gate'

const markSubmittedMock = jest.fn()
jest.mock('@/hooks/useSubmissionWindow', () => ({
    markSubmitted: () => markSubmittedMock(),
}))

const waiting: GateState = { kind: 'waiting-on-provider', userMessage: 'Reviewing your proof of address' }
const ready: GateState = { kind: 'ready' }

beforeEach(() => {
    jest.useFakeTimers()
    markSubmittedMock.mockClear()
})
afterEach(() => {
    jest.runOnlyPendingTimers()
    jest.useRealTimers()
})

describe('useWaitingOnProviderModal', () => {
    test('closed until open() is called, even while waiting', () => {
        const { result } = renderHook(({ gate }) => useWaitingOnProviderModal(gate), {
            initialProps: { gate: waiting },
        })
        expect(result.current.isOpen).toBe(false)

        act(() => result.current.open())
        expect(result.current.isOpen).toBe(true)
        expect(markSubmittedMock).toHaveBeenCalledTimes(1)
    })

    test('surfaces the gate userMessage while open', () => {
        const { result } = renderHook(({ gate }) => useWaitingOnProviderModal(gate), {
            initialProps: { gate: waiting },
        })
        act(() => result.current.open())
        expect(result.current.message).toBe('Reviewing your proof of address')
    })

    test('keeps re-arming the poller on an interval while open', () => {
        const { result } = renderHook(({ gate }) => useWaitingOnProviderModal(gate), {
            initialProps: { gate: waiting },
        })
        act(() => result.current.open())
        markSubmittedMock.mockClear()

        act(() => jest.advanceTimersByTime(60_000))
        // ~20s cadence over 60s → at least a couple more re-arms (poll never lapses)
        expect(markSubmittedMock.mock.calls.length).toBeGreaterThanOrEqual(2)
    })

    test('auto-dismisses and drops the flag when the gate resolves', () => {
        const { result, rerender } = renderHook<ReturnType<typeof useWaitingOnProviderModal>, { gate: GateState }>(
            ({ gate }) => useWaitingOnProviderModal(gate),
            { initialProps: { gate: waiting } }
        )
        act(() => result.current.open())
        expect(result.current.isOpen).toBe(true)

        // bridge finished → gate clears
        rerender({ gate: ready })
        expect(result.current.isOpen).toBe(false)

        // a transient re-flip must NOT reopen it (stale-flag guard)
        rerender({ gate: waiting })
        expect(result.current.isOpen).toBe(false)
    })

    test('close() hides the modal', () => {
        const { result } = renderHook(({ gate }) => useWaitingOnProviderModal(gate), {
            initialProps: { gate: waiting },
        })
        act(() => result.current.open())
        act(() => result.current.close())
        expect(result.current.isOpen).toBe(false)
    })
})
