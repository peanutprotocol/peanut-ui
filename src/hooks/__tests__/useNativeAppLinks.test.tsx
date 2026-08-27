// deferred-deep-link wiring in useNativeAppLinks: the restored dest must land
// unless a real deep link actually navigated — this is the only place that
// happens, so it needs its own coverage (the pure payload logic is tested in
// deferred-link.test.ts).
import { renderHook, waitFor } from '@testing-library/react'
import { useNativeAppLinks } from '../useNativeAppLinks'
import { restoreDeferredContext } from '@/utils/deferred-link'
import { markDeepLinkNavigated, resetDeepLinkStateForTests } from '@/utils/deep-link-state'
import { getOneSignalAdapter } from '@/services/onesignal'

const push = jest.fn()
jest.mock('next/navigation', () => ({
    useRouter: () => ({ push, back: jest.fn() }),
}))

jest.mock('@sentry/nextjs', () => ({ captureMessage: jest.fn() }))

jest.mock('@/utils/capacitor', () => ({
    isCapacitor: jest.fn(() => true),
    getPlatform: jest.fn(() => 'android-native'),
    openExternalUrl: jest.fn(() => Promise.resolve()),
    closeInAppBrowser: jest.fn(() => Promise.resolve()),
    markInAppBrowserClosed: jest.fn(),
}))

jest.mock('@/services/onesignal', () => ({
    getOneSignalAdapter: jest.fn(() => Promise.resolve({ onNotificationClick: jest.fn(() => () => {}) })),
}))

let launchUrl: string | undefined
jest.mock('@capacitor/app', () => ({
    App: {
        getLaunchUrl: jest.fn(() => Promise.resolve(launchUrl ? { url: launchUrl } : undefined)),
        addListener: jest.fn(() => Promise.resolve({ remove: jest.fn() })),
        minimizeApp: jest.fn(),
    },
}))

jest.mock('@/utils/deferred-link', () => ({
    restoreDeferredContext: jest.fn(() => Promise.resolve(null)),
}))

const mockRestore = restoreDeferredContext as jest.MockedFunction<typeof restoreDeferredContext>

beforeEach(() => {
    jest.clearAllMocks()
    launchUrl = undefined
    // Module state + the launch-url guard outlive a test: without these resets
    // an earlier test's navigation suppresses the next test's launch dispatch.
    resetDeepLinkStateForTests()
    sessionStorage.clear()
})

describe('useNativeAppLinks deferred restore wiring', () => {
    it('pushes the restored dest when there is no launch url', async () => {
        mockRestore.mockResolvedValue({ dest: '/claim?x=1', locale: null })

        renderHook(() => useNativeAppLinks())

        await waitFor(() => expect(push).toHaveBeenCalledWith('/claim?x=1'))
    })

    it('yields the landing to a deep link that actually navigated', async () => {
        launchUrl = 'https://peanut.me/home'
        mockRestore.mockResolvedValue({ dest: '/claim?x=1', locale: null })

        renderHook(() => useNativeAppLinks())

        await waitFor(() => expect(mockRestore).toHaveBeenCalled())
        await waitFor(() => expect(push).toHaveBeenCalledWith('/home'))
        expect(push).not.toHaveBeenCalledWith('/claim?x=1')
    })

    it('still pushes the restored dest when the launch url was rejected (off-host)', async () => {
        launchUrl = 'https://evil.com/x'
        mockRestore.mockResolvedValue({ dest: '/claim?x=1', locale: null })

        renderHook(() => useNativeAppLinks())

        await waitFor(() => expect(push).toHaveBeenCalledWith('/claim?x=1'))
    })

    it('drops the dest when the restore resolves late (user already mid-flow), cookies still applied upstream', async () => {
        let fakeNow = 1_000
        const nowSpy = jest.spyOn(Date, 'now').mockImplementation(() => fakeNow)
        mockRestore.mockImplementation(() => {
            // e.g. the paste prompt sat unanswered for 20s before the user allowed it
            fakeNow += 20_000
            return Promise.resolve({ dest: '/claim?x=1', locale: null })
        })

        renderHook(() => useNativeAppLinks())

        await waitFor(() => expect(mockRestore).toHaveBeenCalled())
        await new Promise((r) => setTimeout(r, 0))
        expect(push).not.toHaveBeenCalledWith('/claim?x=1')
        nowSpy.mockRestore()
    })

    it('a restore failure never breaks the rest of init', async () => {
        mockRestore.mockRejectedValue(new Error('boom'))

        renderHook(() => useNativeAppLinks())

        // push-tap routing registers after the restore block — it must still run
        const mockAdapter = getOneSignalAdapter as jest.MockedFunction<typeof getOneSignalAdapter>
        await waitFor(() => expect(mockAdapter).toHaveBeenCalled())
        expect(push).not.toHaveBeenCalled()
    })
})

describe('launch-url replay guard', () => {
    it('stamps the launch url even when RootRedirect already routed it, so a webview reload cannot replay it', async () => {
        launchUrl = 'https://peanut.me/claim?i=abc'
        // RootRedirect recovered the same URL from location on the full-document load
        markDeepLinkNavigated()

        const first = renderHook(() => useNativeAppLinks())
        await waitFor(() => expect(getOneSignalAdapter).toHaveBeenCalled())
        expect(push).not.toHaveBeenCalled()
        first.unmount()

        // logout / hard-nav fallback: same process, fresh module state,
        // getLaunchUrl still returns the original URL
        resetDeepLinkStateForTests()
        jest.clearAllMocks()

        renderHook(() => useNativeAppLinks())
        await waitFor(() => expect(getOneSignalAdapter).toHaveBeenCalled())
        expect(push).not.toHaveBeenCalled()
    })

    it('still dispatches a launch url that nothing has handled', async () => {
        launchUrl = 'https://peanut.me/claim?i=unhandled'

        renderHook(() => useNativeAppLinks())

        await waitFor(() => expect(push).toHaveBeenCalledWith('/claim?i=unhandled'))
    })
})
