/** @jest-environment jsdom */
/**
 * Native return signals for the hosted-verification wait. The in-app browser
 * emits `browserFinished` when the user swipes the sheet away, but a universal
 * link closes it programmatically (closeInAppBrowser), which on iOS never
 * emits it — the document event is that second signal. Each must refetch.
 */
import { act, renderHook, waitFor } from '@testing-library/react'
import { useHostedVerification } from '../useHostedVerification'

const CLOSED_EVENT = 'peanut:in-app-browser-closed'

const mockFetchUser = jest.fn(() => Promise.resolve())
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ fetchUser: mockFetchUser }) }))

const mockRefreshKyc = jest.fn(() => Promise.resolve({ expedited: true }))
jest.mock('@/app/actions/sumsub', () => ({
    startHostedVerification: jest.fn(() => Promise.resolve({ url: 'https://bridge.withpersona.com/verify' })),
    refreshKycState: () => mockRefreshKyc(),
}))
const mockMarkSubmitted = jest.fn()
jest.mock('@/hooks/useSubmissionWindow', () => ({ markSubmitted: () => mockMarkSubmitted() }))

const mockOpenExternalUrl = jest.fn(() => Promise.resolve())
jest.mock('@/utils/capacitor', () => ({
    isNativeBridge: () => true,
    openExternalUrl: (...args: unknown[]) => mockOpenExternalUrl(...(args as [])),
    IN_APP_BROWSER_CLOSED_EVENT: 'peanut:in-app-browser-closed',
}))

const listeners: Record<string, () => void> = {}
const mockRemove = jest.fn()
const mockAddListener = jest.fn((name: string, cb: () => void) => {
    listeners[name] = cb
    return Promise.resolve({ remove: mockRemove })
})
// Virtual, like every other suite that mocks the plugin: the hook reaches it
// through a dynamic import, and a non-virtual mock left the listener
// unregistered on the Node 20 CI runners.
jest.mock(
    '@capacitor/browser',
    () => ({ Browser: { addListener: (name: string, cb: () => void) => mockAddListener(name, cb) } }),
    { virtual: true }
)

describe('useHostedVerification (native)', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockRefreshKyc.mockImplementation(() => Promise.resolve({ expedited: true }))
        mockAddListener.mockImplementation((name: string, cb: () => void) => {
            listeners[name] = cb
            return Promise.resolve({ remove: mockRemove })
        })
        for (const key of Object.keys(listeners)) delete listeners[key]
    })

    const startAndArm = async (actionKey: 'bridge-hosted' | 'rain-hosted' = 'bridge-hosted') => {
        const hook = renderHook(() => useHostedVerification(actionKey))
        await act(async () => {
            await hook.result.current.start()
        })
        expect(mockOpenExternalUrl).toHaveBeenCalledWith('https://bridge.withpersona.com/verify')
        // the dynamic @capacitor/browser import chain settles a few ticks later
        await waitFor(() => expect(mockAddListener).toHaveBeenCalledWith('browserFinished', expect.any(Function)))
        return hook
    }

    it('the first browserFinished opens the settle window: poller re-armed, API asked once, user refetched once', async () => {
        const hook = await startAndArm()
        expect(mockFetchUser).not.toHaveBeenCalled()
        await act(async () => listeners.browserFinished())
        expect(mockMarkSubmitted).toHaveBeenCalledTimes(1)
        expect(mockRefreshKyc).toHaveBeenCalledTimes(1)
        expect(mockFetchUser).toHaveBeenCalledTimes(1)
        expect(hook.result.current.isSettling).toBe(true)
        // a second signal inside the window only refetches — no second window
        await act(async () => listeners.browserFinished())
        expect(mockRefreshKyc).toHaveBeenCalledTimes(1)
        expect(mockMarkSubmitted).toHaveBeenCalledTimes(1)
        expect(mockFetchUser).toHaveBeenCalledTimes(2)
    })

    it('a programmatic close (the universal-link return leg) is a return too', async () => {
        await startAndArm()
        await act(async () => {
            document.dispatchEvent(new CustomEvent(CLOSED_EVENT))
        })
        expect(mockFetchUser).toHaveBeenCalledTimes(1)
        expect(mockRefreshKyc).toHaveBeenCalledTimes(1)
    })

    it('a rain-hosted return is one refetch, no window, no Bridge expedite', async () => {
        const hook = await startAndArm('rain-hosted')
        await act(async () => listeners.browserFinished())
        expect(mockFetchUser).toHaveBeenCalledTimes(1)
        expect(mockRefreshKyc).not.toHaveBeenCalled()
        expect(mockMarkSubmitted).not.toHaveBeenCalled()
        expect(hook.result.current.isSettling).toBe(false)
    })

    it('a BFCache restore before any launch only refetches', () => {
        const hook = renderHook(() => useHostedVerification('bridge-hosted'))
        const restore = new Event('pageshow') as PageTransitionEvent
        Object.defineProperty(restore, 'persisted', { value: true })
        act(() => {
            window.dispatchEvent(restore)
        })
        expect(mockFetchUser).toHaveBeenCalledTimes(1)
        expect(mockRefreshKyc).not.toHaveBeenCalled()
        expect(hook.result.current.isSettling).toBe(false)
    })

    it('nudges again at 20s and 40s until the task clears, then stops', async () => {
        jest.useFakeTimers()
        try {
            let taskPending = true
            const hook = renderHook(() => useHostedVerification('bridge-hosted', { taskPending }))
            await act(async () => {
                await hook.result.current.start()
            })
            await waitFor(() => expect(mockAddListener).toHaveBeenCalledWith('browserFinished', expect.any(Function)))
            await act(async () => listeners.browserFinished())
            expect(hook.result.current.isSettling).toBe(true)
            expect(mockRefreshKyc).toHaveBeenCalledTimes(1)
            expect(mockMarkSubmitted).toHaveBeenCalledTimes(1)

            await act(async () => {
                jest.advanceTimersByTime(20_000)
            })
            expect(mockRefreshKyc).toHaveBeenCalledTimes(2)
            expect(mockMarkSubmitted).toHaveBeenCalledTimes(2)

            taskPending = false
            hook.rerender()
            expect(hook.result.current.isSettling).toBe(false)
            expect(hook.result.current.stillPendingAfterReturn).toBe(false)
            await act(async () => {
                jest.advanceTimersByTime(30_000)
            })
            expect(mockRefreshKyc).toHaveBeenCalledTimes(2)
            expect(mockMarkSubmitted).toHaveBeenCalledTimes(2)
        } finally {
            jest.useRealTimers()
        }
    })

    it('stops asking the API once it answers that there is nothing to expedite; the poller is still re-armed', async () => {
        jest.useFakeTimers()
        try {
            mockRefreshKyc.mockImplementation(() => Promise.resolve({ expedited: false }))
            const hook = renderHook(() => useHostedVerification('bridge-hosted', { taskPending: true }))
            await act(async () => {
                await hook.result.current.start()
            })
            await waitFor(() => expect(mockAddListener).toHaveBeenCalledWith('browserFinished', expect.any(Function)))
            await act(async () => listeners.browserFinished())
            await act(async () => {
                jest.advanceTimersByTime(40_000)
            })
            expect(mockRefreshKyc).toHaveBeenCalledTimes(1)
            expect(mockMarkSubmitted).toHaveBeenCalledTimes(3)
        } finally {
            jest.useRealTimers()
        }
    })

    it('reports a task still pending when the window ends, and a new start clears that', async () => {
        jest.useFakeTimers()
        try {
            const hook = renderHook(() => useHostedVerification('bridge-hosted', { taskPending: true }))
            await act(async () => {
                await hook.result.current.start()
            })
            await waitFor(() => expect(mockAddListener).toHaveBeenCalledWith('browserFinished', expect.any(Function)))
            await act(async () => listeners.browserFinished())
            await act(async () => {
                jest.advanceTimersByTime(61_000)
            })
            expect(hook.result.current.isSettling).toBe(false)
            expect(hook.result.current.stillPendingAfterReturn).toBe(true)

            await act(async () => {
                await hook.result.current.start()
            })
            expect(hook.result.current.stillPendingAfterReturn).toBe(false)
        } finally {
            jest.useRealTimers()
        }
    })

    it('does not listen before the flow was started', () => {
        renderHook(() => useHostedVerification('bridge-hosted'))
        act(() => {
            document.dispatchEvent(new CustomEvent(CLOSED_EVENT))
        })
        expect(mockFetchUser).not.toHaveBeenCalled()
        expect(listeners.browserFinished).toBeUndefined()
    })

    it('removes both listeners on unmount', async () => {
        const hook = await startAndArm()
        hook.unmount()
        expect(mockRemove).toHaveBeenCalledTimes(1)
        act(() => {
            document.dispatchEvent(new CustomEvent(CLOSED_EVENT))
        })
        expect(mockFetchUser).not.toHaveBeenCalled()
    })
})
