/** @jest-environment jsdom */
jest.mock('@/utils/native-platform', () => require('@/test-utils/native-platform-mock').createNativePlatformMock())

/**
 * Web launch leg: the tab is reserved inside the click and navigated once the
 * link lands. A tab Safari hands back already cross-origin cannot be detached,
 * so the launch must fall back to this tab rather than throw out of the click.
 */
import { act, renderHook } from '@testing-library/react'
import { useHostedVerification } from '../useHostedVerification'

const HOSTED_URL = 'https://bridge.withpersona.com/verify'

const mockFetchUser = jest.fn(() => Promise.resolve())
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ fetchUser: mockFetchUser }) }))
jest.mock('@/app/actions/sumsub', () => ({
    startHostedVerification: jest.fn(() => Promise.resolve({ url: 'https://bridge.withpersona.com/verify' })),
    refreshKycState: jest.fn(() => Promise.resolve({ expedited: true })),
}))
jest.mock('@/hooks/useSubmissionWindow', () => ({ markSubmitted: jest.fn() }))
jest.mock('@/utils/capacitor', () => ({
    isNativeBridge: () => false,
    openExternalUrl: jest.fn(),
    IN_APP_BROWSER_CLOSED_EVENT: 'peanut:in-app-browser-closed',
}))

describe('useHostedVerification (web)', () => {
    const original = window.location
    let assign: jest.Mock

    beforeEach(() => {
        jest.clearAllMocks()
        assign = jest.fn()
        Object.defineProperty(window, 'location', {
            configurable: true,
            value: {
                ...original,
                set href(url: string) {
                    assign(url)
                },
            },
        })
    })

    afterEach(() => {
        Object.defineProperty(window, 'location', { configurable: true, value: original })
        jest.restoreAllMocks()
    })

    it('navigates the reserved, detached tab once the link lands', async () => {
        const tab = { opener: {} as unknown, closed: false, close: jest.fn(), location: { href: '' } }
        jest.spyOn(window, 'open').mockReturnValue(tab as unknown as Window)
        const hook = renderHook(() => useHostedVerification('bridge-hosted'))

        await act(async () => {
            await hook.result.current.start()
        })

        expect(tab.opener).toBeNull()
        expect(tab.location.href).toBe(HOSTED_URL)
        expect(assign).not.toHaveBeenCalled()
    })

    // the Pix provider's hosted check: the action carries its link, so nothing asks the API for one
    it('opens the link an action carries without asking the API for one, and reads again on return', async () => {
        const { startHostedVerification } = jest.requireMock('@/app/actions/sumsub')
        const tab = { opener: {} as unknown, closed: false, close: jest.fn(), location: { href: '' } }
        jest.spyOn(window, 'open').mockReturnValue(tab as unknown as Window)
        const link = 'https://provider.example/identity/u1'
        const hook = renderHook(() => useHostedVerification('hosted-identity', { url: link }))

        await act(async () => {
            await hook.result.current.start()
        })

        expect(startHostedVerification).not.toHaveBeenCalled()
        expect(tab.location.href).toBe(link)
        // back from the provider's page: one capabilities read, no Bridge settle window
        act(() => {
            document.dispatchEvent(new Event('visibilitychange'))
        })
        expect(mockFetchUser).toHaveBeenCalledTimes(1)
        expect(hook.result.current.isSettling).toBe(false)
    })

    it('opens nothing for a hosted Pix check whose action carries no link', async () => {
        const { startHostedVerification } = jest.requireMock('@/app/actions/sumsub')
        const tab = { opener: {} as unknown, closed: false, close: jest.fn(), location: { href: '' } }
        jest.spyOn(window, 'open').mockReturnValue(tab as unknown as Window)
        const hook = renderHook(() => useHostedVerification('hosted-identity'))

        await act(async () => {
            await hook.result.current.start()
        })

        expect(startHostedVerification).not.toHaveBeenCalled()
        expect(tab.close).toHaveBeenCalled()
        expect(hook.result.current.error).not.toBeNull()
    })

    it('falls back to this tab when the reserved tab cannot be detached', async () => {
        const tab = {
            closed: false,
            close: jest.fn(),
            location: { href: '' },
            set opener(_value: unknown) {
                throw new DOMException('Blocked a frame from accessing a cross-origin frame.', 'SecurityError')
            },
        }
        jest.spyOn(window, 'open').mockReturnValue(tab as unknown as Window)
        const hook = renderHook(() => useHostedVerification('bridge-hosted'))

        await act(async () => {
            await hook.result.current.start()
        })

        expect(tab.close).toHaveBeenCalled()
        expect(tab.location.href).toBe('')
        expect(assign).toHaveBeenCalledWith(HOSTED_URL)
        expect(hook.result.current.isStarting).toBe(false)
        expect(hook.result.current.error).toBeNull()
    })
})
