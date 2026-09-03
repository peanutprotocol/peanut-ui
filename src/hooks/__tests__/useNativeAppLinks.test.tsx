// deferred-deep-link wiring in useNativeAppLinks: the restored dest must land
// unless a real deep link actually navigated — this is the only place that
// happens, so it needs its own coverage (the pure payload logic is tested in
// deferred-link.test.ts).
import { renderHook, waitFor } from '@testing-library/react'
import { useNativeAppLinks } from '../useNativeAppLinks'
import { restoreDeferredContext } from '@/utils/deferred-link'
import { markDeepLinkNavigated, resetDeepLinkStateForTests } from '@/utils/deep-link-state'
import { getOneSignalAdapter } from '@/services/onesignal'
import { BASE_URL } from '@/constants/general.consts'
import { App } from '@capacitor/app'
import { registerBackHandler, resetBackHandlersForTests } from '@/utils/back-handler'

const push = jest.fn()
const back = jest.fn()
jest.mock('next/navigation', () => ({
    useRouter: () => ({ push, back }),
}))

jest.mock('@sentry/nextjs', () => ({ captureMessage: jest.fn() }))

const capture = jest.fn()
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: (...a: unknown[]) => capture(...a) } }))

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
    resetBackHandlersForTests()
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

describe('hardware back button', () => {
    type BackButtonCallback = (event: { canGoBack: boolean }) => void

    const getBackButtonCallback = async (): Promise<BackButtonCallback> => {
        const addListener = App.addListener as jest.Mock
        await waitFor(() => expect(addListener.mock.calls.some(([name]) => name === 'backButton')).toBe(true))
        return addListener.mock.calls.find(([name]) => name === 'backButton')![1]
    }

    it('lets a registered handler consume the press before any navigation', async () => {
        renderHook(() => useNativeAppLinks())
        const onBack = await getBackButtonCallback()
        const handler = jest.fn(() => true)
        registerBackHandler(handler)

        onBack({ canGoBack: true })

        expect(handler).toHaveBeenCalledTimes(1)
        expect(back).not.toHaveBeenCalled()
        expect(App.minimizeApp).not.toHaveBeenCalled()
    })

    it('walks history when nothing consumed the press and there is history', async () => {
        renderHook(() => useNativeAppLinks())
        const onBack = await getBackButtonCallback()
        registerBackHandler(() => false)

        onBack({ canGoBack: true })

        expect(back).toHaveBeenCalledTimes(1)
        expect(App.minimizeApp).not.toHaveBeenCalled()
    })

    it('minimizes the app when nothing consumed the press and there is no history', async () => {
        renderHook(() => useNativeAppLinks())
        const onBack = await getBackButtonCallback()

        onBack({ canGoBack: false })

        expect(back).not.toHaveBeenCalled()
        expect(App.minimizeApp).toHaveBeenCalledTimes(1)
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

describe('document click interceptor', () => {
    const { openExternalUrl } = jest.requireMock('@/utils/capacitor')

    const clickAnchor = (attrs: Record<string, string>) => {
        const a = document.createElement('a')
        Object.entries(attrs).forEach(([k, v]) => a.setAttribute(k, v))
        a.textContent = 'link'
        document.body.appendChild(a)
        const event = new MouseEvent('click', { bubbles: true, cancelable: true })
        a.dispatchEvent(event)
        a.remove()
        return event
    }

    it('opens a web-only relative href in the in-app browser instead of client-navigating', async () => {
        renderHook(() => useNativeAppLinks())
        const event = clickAnchor({ href: '/en/help/fees-pricing' })
        expect(event.defaultPrevented).toBe(true)
        expect(openExternalUrl).toHaveBeenCalledWith(`${BASE_URL}/en/help/fees-pricing`)
    })

    it('leaves relative hrefs the native export ships alone', async () => {
        renderHook(() => useNativeAppLinks())
        const home = clickAnchor({ href: '/home' })
        const card = clickAnchor({ href: '/shhhhh' })
        expect(home.defaultPrevented).toBe(false)
        expect(card.defaultPrevented).toBe(false)
        expect(openExternalUrl).not.toHaveBeenCalled()
    })

    it('still routes absolute target="_blank" hrefs through the in-app browser', async () => {
        renderHook(() => useNativeAppLinks())
        const event = clickAnchor({ href: 'https://example.com/doc', target: '_blank' })
        expect(event.defaultPrevented).toBe(true)
        expect(openExternalUrl).toHaveBeenCalledWith('https://example.com/doc')
    })

    it('ignores hash and non-path hrefs', async () => {
        renderHook(() => useNativeAppLinks())
        const hash = clickAnchor({ href: '#chat' })
        const mail = clickAnchor({ href: 'mailto:hello@peanut.me' })
        expect(hash.defaultPrevented).toBe(false)
        expect(mail.defaultPrevented).toBe(false)
        expect(openExternalUrl).not.toHaveBeenCalled()
    })
})

describe('deep-link telemetry redaction', () => {
    // A claim link carries its password in `#p=<password>`, and
    // deepLinkToNativePath deliberately preserves the fragment so the claim page
    // can read it. That password derives the private claim key, so it must never
    // reach analytics — anyone with PostHog access could otherwise claim the funds.
    it('never sends a claim password or query to analytics', async () => {
        launchUrl = 'https://peanut.me/claim?c=8453&v=v4.2&i=42#p=SUPERSECRET'

        renderHook(() => useNativeAppLinks())

        await waitFor(() => expect(capture).toHaveBeenCalled())
        const payloads = JSON.stringify(capture.mock.calls)
        expect(payloads).not.toContain('SUPERSECRET')
        expect(payloads).not.toContain('#p=')
        expect(payloads).not.toContain('c=8453')

        const [, props] = capture.mock.calls.find(([name]) => name === 'native_link_received') as [
            string,
            Record<string, unknown>,
        ]
        expect(props.raw).toBe('https://peanut.me/claim')
        expect(props.mapped).toBe('/claim')
    })

    // The code sits in a PATH segment, so dropping query and fragment left it
    // fully readable in `raw`. Opening the link reaches captureLink before the
    // user claims the QR, and the claim API binds a code to the first
    // authenticated account that presents it — so a PostHog reader could race
    // the intended owner and take the QR permanently.
    it('never sends an unclaimed QR code to analytics', async () => {
        launchUrl = 'https://peanut.me/qr/aB3xK9mQ2pL7vN4z'

        renderHook(() => useNativeAppLinks())

        await waitFor(() => expect(capture).toHaveBeenCalled())
        const payloads = JSON.stringify(capture.mock.calls)
        expect(payloads).not.toContain('aB3xK9mQ2pL7vN4z')

        const [, props] = capture.mock.calls.find(([name]) => name === 'native_link_received') as [
            string,
            Record<string, unknown>,
        ]
        // The route family survives — that is the whole diagnostic value.
        expect(props.raw).toBe('https://peanut.me/qr/:id')
    })

    it('redacts the QR code on the success sub-route too', async () => {
        launchUrl = 'https://peanut.me/qr/aB3xK9mQ2pL7vN4z/success'

        renderHook(() => useNativeAppLinks())

        await waitFor(() => expect(capture).toHaveBeenCalled())
        expect(JSON.stringify(capture.mock.calls)).not.toContain('aB3xK9mQ2pL7vN4z')
    })
})
