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

jest.mock('@/app/actions/sumsub', () => ({
    startHostedVerification: jest.fn(() => Promise.resolve({ url: 'https://bridge.withpersona.com/verify' })),
}))

const mockOpenExternalUrl = jest.fn(() => Promise.resolve())
jest.mock('@/utils/capacitor', () => ({
    isNativeBridge: () => true,
    openExternalUrl: (...args: unknown[]) => mockOpenExternalUrl(...(args as [])),
    IN_APP_BROWSER_CLOSED_EVENT: 'peanut:in-app-browser-closed',
}))

const listeners: Record<string, () => void> = {}
const mockRemove = jest.fn()
jest.mock('@capacitor/browser', () => ({
    Browser: {
        addListener: jest.fn((name: string, cb: () => void) => {
            listeners[name] = cb
            return Promise.resolve({ remove: mockRemove })
        }),
    },
}))

describe('useHostedVerification (native)', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        for (const key of Object.keys(listeners)) delete listeners[key]
    })

    const startAndArm = async () => {
        const hook = renderHook(() => useHostedVerification('bridge-hosted'))
        await act(async () => {
            await hook.result.current.start()
        })
        expect(mockOpenExternalUrl).toHaveBeenCalledWith('https://bridge.withpersona.com/verify')
        // the dynamic @capacitor/browser import chain settles a few ticks later
        await waitFor(() => expect(listeners.browserFinished).toBeDefined())
        return hook
    }

    it('refetches once per browserFinished', async () => {
        await startAndArm()
        expect(mockFetchUser).not.toHaveBeenCalled()
        act(() => listeners.browserFinished())
        expect(mockFetchUser).toHaveBeenCalledTimes(1)
        act(() => listeners.browserFinished())
        expect(mockFetchUser).toHaveBeenCalledTimes(2)
    })

    it('refetches once per programmatic close (the universal-link return leg)', async () => {
        await startAndArm()
        act(() => {
            document.dispatchEvent(new CustomEvent(CLOSED_EVENT))
        })
        expect(mockFetchUser).toHaveBeenCalledTimes(1)
        act(() => listeners.browserFinished())
        expect(mockFetchUser).toHaveBeenCalledTimes(2)
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
