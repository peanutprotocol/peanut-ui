/**
 * (mobile-ui) layout — what happens when there is no user.
 *
 * Two different states end with `user === null`: the backend is down, and the
 * person is not signed in. Only the second one may reach /setup. The user query
 * throws for a 5xx and returns null for a 401, so `userFetchError` is the signal
 * that tells them apart.
 */
import React from 'react'
import { render, screen, act } from '@testing-library/react'

const mockRouterReplace = jest.fn()

jest.mock('next/navigation', () => ({
    useRouter: () => ({ replace: mockRouterReplace, push: jest.fn(), back: jest.fn(), prefetch: jest.fn() }),
    usePathname: () => '/home',
}))

const mockUseAuth = jest.fn()
jest.mock('@/context/authContext', () => ({
    useAuth: () => mockUseAuth(),
}))

jest.mock('@/hooks/useNetworkStatus', () => ({
    useNetworkStatus: () => ({ isOnline: true, isInitialized: true }),
}))
jest.mock('@/hooks/useAccountSetupRedirect', () => ({
    useAccountSetupRedirect: () => ({ needsRedirect: false, isCheckingAccount: false }),
}))
jest.mock('@/hooks/usePullToRefresh', () => ({
    usePullToRefresh: jest.fn(),
    useShouldPullToRefresh: () => () => true,
}))
jest.mock('@/hooks/useNativePlugins', () => ({ useNativePlugins: jest.fn() }))
jest.mock('@/hooks/useKeepWebBypass', () => ({ useKeepWebBypass: () => false }))
jest.mock('@/hooks/useMigrationFlag', () => ({ useMigrationFlag: () => false }))
jest.mock('@/hooks/useSafeBack', () => ({}))
jest.mock('@/redux/hooks', () => ({ useSetupStore: () => ({ showIosPwaInstallScreen: false }) }))
jest.mock('@/utils/demo', () => ({ isDemoMode: () => false, enableDemoMode: jest.fn() }))
jest.mock('@/utils/migration.utils', () => ({ shouldShowSunsetBlock: () => false }))

// Child screens are stubbed: this spec is about which one the layout picks.
jest.mock('@/components/Global/BackendErrorScreen', () => ({
    __esModule: true,
    default: () => <div data-testid="backend-error-screen" />,
}))
jest.mock('@/components/Global/OfflineScreen', () => ({ __esModule: true, default: () => <div /> }))
jest.mock('@/components/Global/Loading', () => ({ __esModule: true, default: () => <div data-testid="loading" /> }))
jest.mock('@/components/Global/AppShell', () => ({
    AppShell: ({ children }: { children: React.ReactNode }) => <div data-testid="app-shell">{children}</div>,
}))
jest.mock('@/components/Global/BottomNav', () => ({ BottomNav: () => <div /> }))
jest.mock('@/components/Global/Banner', () => ({ Banner: () => <div /> }))
jest.mock('@/components/Global/GuestLoginModal', () => ({ __esModule: true, default: () => <div /> }))
jest.mock('@/components/Global/ReConsentModal', () => ({ __esModule: true, default: () => <div /> }))
jest.mock('@/components/Global/SupportDrawer', () => ({ __esModule: true, default: () => <div /> }))
jest.mock('@/components/Global/SupportDeepLink', () => ({ __esModule: true, default: () => <div /> }))
jest.mock('@/components/Global/QRScannerOverlay', () => ({ __esModule: true, default: () => <div /> }))
jest.mock('@/components/Global/SecurityVerificationOverlay', () => ({ __esModule: true, default: () => <div /> }))
jest.mock('@/components/ForceIOSPWAInstall', () => ({ __esModule: true, default: () => <div /> }))
jest.mock('@/components/Invites/JoinWaitlistPage', () => ({ __esModule: true, default: () => <div /> }))
jest.mock('@/components/Migration/SunsetScreen', () => ({ __esModule: true, default: () => <div /> }))

import Layout from '../layout'

const CACHED_USER = {
    user: { userId: 'u1', username: 'probe', hasAppAccess: true },
    accounts: [],
} as any

const authState = (over: Record<string, unknown> = {}) => ({
    user: null,
    isFetchingUser: false,
    userFetchError: null,
    logoutUser: jest.fn(),
    isLoggingOut: false,
    ...over,
})

const renderLayout = () =>
    render(
        <Layout>
            <div data-testid="page" />
        </Layout>
    )

const rerenderLayout = (rerender: (ui: React.ReactElement) => void) =>
    rerender(
        <Layout>
            <div data-testid="page" />
        </Layout>
    )

describe('(mobile-ui) layout — no user', () => {
    beforeEach(() => {
        jest.useFakeTimers()
        mockRouterReplace.mockClear()
    })

    afterEach(() => {
        // drop, never fire: the logged-out fallback calls window.location.replace,
        // which jsdom cannot do.
        jest.clearAllTimers()
        jest.useRealTimers()
    })

    it('backend down: shows the error screen and never sends the user to /setup', () => {
        mockUseAuth.mockReturnValue(authState({ userFetchError: new Error('backend error fetching user') }))

        renderLayout()

        expect(screen.getByTestId('backend-error-screen')).toBeInTheDocument()
        expect(mockRouterReplace).not.toHaveBeenCalled()

        // the redirect arms a 3s hard-nav fallback. it must never have been armed.
        expect(jest.getTimerCount()).toBe(0)
        act(() => {
            jest.advanceTimersByTime(5000)
        })
        expect(screen.getByTestId('backend-error-screen')).toBeInTheDocument()
        expect(mockRouterReplace).not.toHaveBeenCalled()
    })

    it('logged out: still reaches /setup', () => {
        mockUseAuth.mockReturnValue(authState())

        renderLayout()

        expect(screen.queryByTestId('backend-error-screen')).not.toBeInTheDocument()
        expect(mockRouterReplace).toHaveBeenCalledWith('/setup')
    })

    it('error after the redirect is armed: the 3s hard-nav fallback is dropped', () => {
        mockUseAuth.mockReturnValue(authState())
        const { rerender } = renderLayout()
        expect(jest.getTimerCount()).toBe(1)

        mockUseAuth.mockReturnValue(authState({ userFetchError: new Error('backend error fetching user') }))
        act(() => rerenderLayout(rerender))

        expect(screen.getByTestId('backend-error-screen')).toBeInTheDocument()
        expect(jest.getTimerCount()).toBe(0)
    })

    it('refetch blip over cached data: keeps the app, no error screen, no redirect', () => {
        mockUseAuth.mockReturnValue(authState({ user: CACHED_USER, userFetchError: new Error('blip') }))

        renderLayout()

        expect(screen.queryByTestId('backend-error-screen')).not.toBeInTheDocument()
        expect(screen.getByTestId('app-shell')).toBeInTheDocument()
        expect(mockRouterReplace).not.toHaveBeenCalled()
    })
})
