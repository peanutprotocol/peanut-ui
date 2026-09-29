/**
 * The reproduce bootstrap has to run on every browser, not only the ones whose
 * provider chunks happen to be warm.
 *
 * `?__reproduce=<id>` opened on a desktop user agent showed the mascot forever:
 * the bootstrap was mounted at the bottom of ClientProviders' lazily-loaded
 * provider tree behind its own `<Suspense fallback={null}>`, and it read the
 * session id through `useSearchParams()` — a Suspense-bailout hook. With that
 * boundary unresolved the effect never ran, no manifest was fetched, and the
 * (mobile-ui) layout held its loader because the `?__reproduce` branch
 * deliberately suppresses the /setup bounce while it waits for the reload.
 *
 * This spec mounts the root-layout client boundary — the one every user agent
 * goes through — and asserts the manifest fetch fires.
 */
import React from 'react'
import { render, waitFor } from '@testing-library/react'

// Every dynamic() gets its own boundary here, the same way the real one does.
jest.mock('next/dynamic', () => ({
    __esModule: true,
    default: (loader: () => Promise<React.ComponentType<any>>) => {
        const Lazy = React.lazy(() => loader().then((C) => ({ default: C })))
        return (props: any) => (
            <React.Suspense fallback={null}>
                <Lazy {...props} />
            </React.Suspense>
        )
    },
}))

jest.mock('@/constants/harness.consts', () => ({ HARNESS_ENABLED: true }))
jest.mock('@/constants/dev-tools.consts', () => ({ DEV_TOOLS_ENABLED: false }))

const passthrough = (name: string) => ({
    [name]: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
})

jest.mock('next/navigation', () => ({ usePathname: () => '/add-money' }))
jest.mock('nuqs/adapters/next/app', () => passthrough('NuqsAdapter'))
jest.mock('@/context/OtaUpdateContext', () => passthrough('OtaUpdateProvider'))
jest.mock('@/config/peanut.config', () => passthrough('PeanutProvider'))
jest.mock('@/context/contextProvider', () => passthrough('ContextProvider'))
jest.mock('@/context/footerVisibility', () => passthrough('FooterVisibilityProvider'))
jest.mock('@/components/Global/TranslationSafeWrapper', () => passthrough('TranslationSafeWrapper'))
jest.mock('@/i18n/app/AppIntlProvider', () => passthrough('AppIntlProvider'))
jest.mock('@/i18n/app/MarketingIntlProvider', () => passthrough('MarketingIntlProvider'))
jest.mock('../AppGlobals', () => passthrough('AppGlobals'))
jest.mock('@/components/Global/AppHelpProvider', () => passthrough('AppHelpProvider'))
jest.mock('@/components/Global/ConsoleGreeting', () => ({ ConsoleGreeting: () => null }))
jest.mock('@/components/Global/ScreenOrientationLocker', () => ({ ScreenOrientationLocker: () => null }))
jest.mock('@/components/Analytics/PathnamePageviewTracker', () => ({ PathnamePageviewTracker: () => null }))
// ScreenTransitionTracker reads query state through nuqs; this spec mocks the
// adapter to a passthrough, so stub the tracker like the pageview one above —
// the reproduce-manifest assertions do not depend on analytics.
jest.mock('@/components/Analytics/ScreenTransitionTracker', () => ({ ScreenTransitionTracker: () => null }))
jest.mock('@/components/Global/UnsupportedWebViewScreen', () => ({
    UnsupportedWebViewScreen: () => null,
    hasUnsupportedWebViewBypass: () => true,
}))
jest.mock('@/hooks/useSplashGate', () => ({ useSplashGate: jest.fn() }))
jest.mock('@/hooks/useNativeAppLinks', () => ({ useNativeAppLinks: jest.fn() }))
jest.mock('@/hooks/useZeroLegacyAndroidSafeAreaInsets', () => ({ useZeroLegacyAndroidSafeAreaInsets: jest.fn() }))
jest.mock('@/utils/capacitor', () => ({
    applyLegacyAndroidSafeAreaZeroFromUserAgent: jest.fn(),
    isCapacitor: () => false,
    isWebViewCssSupported: () => true,
}))
jest.mock('@/utils/marketing-routes', () => ({ isMarketingRoute: () => false }))
jest.mock('@/context/HarnessReplay', () => ({ HarnessReplay: () => null }))

import { ClientProviders } from '../ClientProviders'

const reload = jest.fn()

beforeEach(() => {
    jest.clearAllMocks()
    process.env.NEXT_PUBLIC_HARNESS_SKIP_PASSKEY_CHECK = 'true'
    process.env.NEXT_PUBLIC_PEANUT_API_URL = 'http://api.test'
    sessionStorage.clear()
    localStorage.clear()

    Object.defineProperty(window, 'location', {
        configurable: true,
        value: {
            href: 'http://app.test/add-money?method=bank&__reproduce=session-9',
            search: '?method=bank&__reproduce=session-9',
            pathname: '/add-money',
            reload,
        },
    })
    Object.defineProperty(window, 'caches', {
        configurable: true,
        value: { keys: jest.fn().mockResolvedValue([]), delete: jest.fn().mockResolvedValue(true) },
    })
    Object.defineProperty(window.navigator, 'serviceWorker', {
        configurable: true,
        value: { getRegistrations: jest.fn().mockResolvedValue([]) },
    })
    global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ localStorage: {}, token: 'fresh-jwt' }),
    }) as unknown as typeof fetch
})

it('fetches the reproduce manifest from the root client boundary, on any user agent', async () => {
    render(
        <ClientProviders>
            <div />
        </ClientProviders>
    )

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('http://api.test/dev/reproduce/session-9'))
})

it('is a no-op without the reproduce param', async () => {
    window.location.search = '?method=bank'
    window.location.href = 'http://app.test/add-money?method=bank'

    render(
        <ClientProviders>
            <div />
        </ClientProviders>
    )

    await waitFor(() => expect(sessionStorage.getItem('__reproduce_applied')).toBeNull())
    expect(global.fetch).not.toHaveBeenCalled()
})
