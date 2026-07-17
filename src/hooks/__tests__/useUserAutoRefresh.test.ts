import { act, renderHook } from '@testing-library/react'
import { useUserAutoRefresh } from '@/hooks/useUserAutoRefresh'
import { markSubmitted, __resetSubmissionWindowForTests } from '@/hooks/useSubmissionWindow'
import type { IUserProfile } from '@/interfaces/interfaces'

const userWithPendingRail = {
    capabilities: { rails: [{ status: 'pending' }], nextActions: [], restrictions: [] },
} as unknown as IUserProfile

const userAllSettled = {
    capabilities: { rails: [{ status: 'enabled' }], nextActions: [], restrictions: [] },
} as unknown as IUserProfile

describe('useUserAutoRefresh', () => {
    beforeEach(() => {
        jest.useFakeTimers()
        __resetSubmissionWindowForTests()
    })
    afterEach(() => {
        jest.runOnlyPendingTimers()
        jest.useRealTimers()
        __resetSubmissionWindowForTests()
    })

    it('refetches the user every ~4s while a rail is pending', async () => {
        const fetchUser = jest.fn().mockResolvedValue(null)
        renderHook(() => useUserAutoRefresh({ user: userWithPendingRail, fetchUser }))

        expect(fetchUser).not.toHaveBeenCalled()
        await act(async () => {
            jest.advanceTimersByTime(4000)
            await Promise.resolve()
            await Promise.resolve()
        })
        expect(fetchUser).toHaveBeenCalledTimes(1)
        await act(async () => {
            jest.advanceTimersByTime(4000)
            await Promise.resolve()
            await Promise.resolve()
        })
        expect(fetchUser).toHaveBeenCalledTimes(2)
    })

    it('does not stack a second poll while the first is still in flight', async () => {
        let resolveFetch: () => void = () => undefined
        const fetchUser = jest.fn(
            () =>
                new Promise<null>((resolve) => {
                    resolveFetch = () => resolve(null)
                })
        )
        renderHook(() => useUserAutoRefresh({ user: userWithPendingRail, fetchUser }))

        await act(async () => {
            jest.advanceTimersByTime(4000)
            await Promise.resolve()
        })
        expect(fetchUser).toHaveBeenCalledTimes(1)

        // Tick 2 while the first is still pending → in-flight guard blocks it.
        await act(async () => {
            jest.advanceTimersByTime(4000)
            await Promise.resolve()
        })
        expect(fetchUser).toHaveBeenCalledTimes(1)

        // Resolve the held fetch → lock releases → next tick fires.
        await act(async () => {
            resolveFetch()
            await Promise.resolve()
            await Promise.resolve()
            jest.advanceTimersByTime(4000)
            await Promise.resolve()
        })
        expect(fetchUser).toHaveBeenCalledTimes(2)
    })

    it('does not poll when no rail is pending and no submission window is open', () => {
        const fetchUser = jest.fn().mockResolvedValue(null)
        renderHook(() => useUserAutoRefresh({ user: userAllSettled, fetchUser }))
        act(() => {
            jest.advanceTimersByTime(12000)
        })
        expect(fetchUser).not.toHaveBeenCalled()
    })

    it('clears the interval on unmount', () => {
        const fetchUser = jest.fn().mockResolvedValue(null)
        const { unmount } = renderHook(() => useUserAutoRefresh({ user: userWithPendingRail, fetchUser }))
        act(() => {
            jest.advanceTimersByTime(4000)
        })
        expect(fetchUser).toHaveBeenCalledTimes(1)
        unmount()
        act(() => {
            jest.advanceTimersByTime(12000)
        })
        expect(fetchUser).toHaveBeenCalledTimes(1)
    })

    it('polls during the submission window even when no rail is pending', async () => {
        const fetchUser = jest.fn().mockResolvedValue(null)
        const { rerender } = renderHook(({ user }) => useUserAutoRefresh({ user, fetchUser }), {
            initialProps: { user: userAllSettled },
        })

        // Baseline — no polling yet.
        act(() => {
            jest.advanceTimersByTime(8000)
        })
        expect(fetchUser).not.toHaveBeenCalled()

        // Arming the window flips the predicate; re-render to pick up the new
        // `isInWindow` subscription.
        act(() => {
            markSubmitted()
        })
        rerender({ user: userAllSettled })

        await act(async () => {
            jest.advanceTimersByTime(4000)
            await Promise.resolve()
            await Promise.resolve()
        })
        expect(fetchUser).toHaveBeenCalledTimes(1)
    })

    it('stops polling after the submission window expires (no pending rail)', async () => {
        const fetchUser = jest.fn().mockResolvedValue(null)
        const { rerender } = renderHook(({ user }) => useUserAutoRefresh({ user, fetchUser }), {
            initialProps: { user: userAllSettled },
        })
        act(() => {
            markSubmitted()
        })
        rerender({ user: userAllSettled })

        // One tick inside the window fires.
        await act(async () => {
            jest.advanceTimersByTime(4000)
            await Promise.resolve()
            await Promise.resolve()
        })
        expect(fetchUser).toHaveBeenCalledTimes(1)

        // Cross the 30s expiry. The interval's predicate-check should see the
        // window closed and self-terminate (the next render's effect cleanup
        // also clears it).
        await act(async () => {
            jest.advanceTimersByTime(30_000)
            await Promise.resolve()
            await Promise.resolve()
        })
        // Should NOT keep ticking after the window closes.
        const callsAfterExpiry = fetchUser.mock.calls.length
        await act(async () => {
            jest.advanceTimersByTime(12_000)
            await Promise.resolve()
            await Promise.resolve()
        })
        expect(fetchUser.mock.calls.length).toBe(callsAfterExpiry)
    })
})
