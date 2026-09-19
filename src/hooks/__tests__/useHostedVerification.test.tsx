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

const mockRefreshKyc = jest.fn(() => Promise.resolve({ expedited: false }))
jest.mock('@/app/actions/sumsub', () => ({
    startHostedVerification: jest.fn(() => Promise.resolve({ url: 'https://bridge.withpersona.com/verify' })),
    refreshKycState: () => mockRefreshKyc(),
}))

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
        mockAddListener.mockImplementation((name: string, cb: () => void) => {
            listeners[name] = cb
            return Promise.resolve({ remove: mockRemove })
        })
        for (const key of Object.keys(listeners)) delete listeners[key]
    })

    const startAndArm = async () => {
        const hook = renderHook(() => useHostedVerification('bridge-hosted'))
        await act(async () => {
            await hook.result.current.start()
        })
        expect(mockOpenExternalUrl).toHaveBeenCalledWith('https://bridge.withpersona.com/verify')
        // the dynamic @capacitor/browser import chain settles a few ticks later
        await waitFor(() => expect(mockAddListener).toHaveBeenCalledWith('browserFinished', expect.any(Function)))
        return hook
    }

    it('refetches on every browserFinished and asks the API to re-read the provider', async () => {
        await startAndArm()
        expect(mockFetchUser).not.toHaveBeenCalled()
        await act(async () => listeners.browserFinished())
        expect(mockFetchUser).toHaveBeenCalled()
        expect(mockRefreshKyc).toHaveBeenCalledTimes(1)
        await act(async () => listeners.browserFinished())
        expect(mockRefreshKyc).toHaveBeenCalledTimes(2)
    })

    it('a programmatic close (the universal-link return leg) is a return too', async () => {
        await startAndArm()
        await act(async () => {
            document.dispatchEvent(new CustomEvent(CLOSED_EVENT))
        })
        expect(mockFetchUser).toHaveBeenCalled()
        expect(mockRefreshKyc).toHaveBeenCalledTimes(1)
    })

    it('keeps asking every 5s until the task clears, then stops', async () => {
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

            // refetches every 5s; the provider read is paced to 0s / 20s / 40s
            const fetches = mockFetchUser.mock.calls.length
            await act(async () => {
                jest.advanceTimersByTime(5_000)
            })
            expect(mockFetchUser.mock.calls.length).toBeGreaterThan(fetches)
            expect(mockRefreshKyc).toHaveBeenCalledTimes(1)
            // each round re-arms through state, so step the clock one round at a time
            for (let i = 0; i < 3; i++) {
                await act(async () => {
                    jest.advanceTimersByTime(5_000)
                })
            }
            expect(mockRefreshKyc).toHaveBeenCalledTimes(2)

            taskPending = false
            hook.rerender()
            expect(hook.result.current.isSettling).toBe(false)
            expect(hook.result.current.stillPendingAfterReturn).toBe(false)
            await act(async () => {
                jest.advanceTimersByTime(20_000)
            })
            expect(mockRefreshKyc).toHaveBeenCalledTimes(2)
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
