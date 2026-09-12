'use client'

import { AppShell } from '@/components/Global/AppShell'
import { BottomNav } from '@/components/Global/BottomNav'
import GuestLoginModal from '@/components/Global/GuestLoginModal'
import ReConsentModal from '@/components/Global/ReConsentModal'
import Loading from '@/components/Global/Loading'
import OfflineScreen from '@/components/Global/OfflineScreen'
import BackendErrorScreen from '@/components/Global/BackendErrorScreen'
import { useAuth } from '@/context/authContext'
import { usePathname } from 'next/navigation'
import { Suspense, useEffect, useRef, useState } from 'react'
import { twMerge } from '@/utils/tw'
import '../../styles/globals.css'
import QRScannerOverlay from '@/components/Global/QRScannerOverlay'
import SecurityVerificationOverlay from '@/components/Global/SecurityVerificationOverlay'
import SupportDeepLink from '@/components/Global/SupportDeepLink'
import SupportDrawer from '@/components/Global/SupportDrawer'
import JoinWaitlistPage from '@/components/Invites/JoinWaitlistPage'
import { useRouter } from 'next/navigation'
import { NavHeaderPresenceProvider } from '@/components/Global/Banner/navHeaderPresence'
import { ShellBannerFallback } from '@/components/Global/Banner/ShellBannerFallback'
import ForceIOSPWAInstall from '@/components/ForceIOSPWAInstall'
import { isPublicRoute } from '@/constants/routes'
import { saveRedirectUrl } from '@/utils/general.utils'
import { consumeHeldSession, markSessionHeld } from '@/utils/session-presence'
import { IS_DEV } from '@/constants/general.consts'
import { HARNESS_ENABLED } from '@/constants/harness.consts'
import { FixtureBanner } from '@/dev/fixtures/FixtureBanner'
import { usePullToRefresh, useShouldPullToRefresh } from '@/hooks/usePullToRefresh'
import { useLongPressGuard } from '@/hooks/useLongPressGuard'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import { useAccountSetupRedirect } from '@/hooks/useAccountSetupRedirect'
import { useNativePlugins } from '@/hooks/useNativePlugins'
// Side-effect import: useSafeBack patches history.pushState at module load. Importing here
// guarantees the patch is installed before any child page's mount-time router.push.
import '@/hooks/useSafeBack'
import { isCapacitor } from '@/utils/capacitor'
import { isDemoMode, enableDemoMode } from '@/utils/demo'
import SunsetScreen from '@/components/Migration/SunsetScreen'
import { useKeepWebBypass } from '@/hooks/useKeepWebBypass'
import { useMigrationFlag } from '@/hooks/useMigrationFlag'
import { shouldShowSunsetBlock } from '@/utils/migration.utils'
import { useIosPwaInstallGate } from '@/hooks/useIosPwaInstallGate'

const Layout = ({ children }: { children: React.ReactNode }) => {
    useNativePlugins()
    const pathName = usePathname()

    // Allow access to public paths without authentication.
    // Dev tooling (/dev/*) is public only in local IS_DEV builds. Do NOT widen this to
    // staging/previews via BASE_URL: DEV_ONLY_PUBLIC_ROUTES_REGEX covers ALL of /dev,
    // including /dev/debug, whose cheats drive the API dev endpoints — an unauthenticated
    // staging visitor must never reach them. On deployed builds /dev requires login.
    const isPublicPath = isPublicRoute(pathName, IS_DEV)

    const { isFetchingUser, user, userFetchError } = useAuth()
    const [isReady, setIsReady] = useState(false)
    const isUserLoggedIn = !!user?.user.userId || false
    const isHome = pathName === '/home' || pathName === '/home/'
    const isHistory = pathName === '/history'
    const isSupport = pathName === '/support'
    const isReceipt = pathName === '/receipt' || pathName === '/receipt/'
    // The profile menu IS the full-screen menu: the bottom nav and its QR
    // button used to float over its own list of destinations. Exact match —
    // /profile/* sub-pages keep the nav.
    const isProfileMenu = pathName === '/profile' || pathName === '/profile/'
    const isDev = pathName?.startsWith('/dev') ?? false
    const alignStart = isHome || isHistory || isSupport
    const router = useRouter()
    const { showIosPwaInstallScreen } = useIosPwaInstallGate()
    const migrationOn = useMigrationFlag()
    const hasKeepWebBypass = useKeepWebBypass()

    // detect online/offline status for full-page offline screen
    const { isOnline, isInitialized } = useNetworkStatus()

    useEffect(() => {
        setIsReady(true)
    }, [])

    // enable pull-to-refresh for both ios and android
    usePullToRefresh({ shouldPullToRefresh: useShouldPullToRefresh() })

    // no OS long-press link preview on app-shell CTAs and menu rows
    useLongPressGuard()

    const isRedirecting = useRef(false)
    /*
     * Whether this TAB has held a session separates the two reasons the gate
     * below fires — a logged-out arrival at a deep link, or a session
     * collapsing where it stood — and it is recorded per tab rather than per
     * document so a reload after the token was revoked still knows the
     * difference (see session-presence). In an effect, not during render:
     * React can discard or replay a render, and this outlives the one it was
     * observed in. Declared above the gate so the gate reads it settled.
     */
    useEffect(() => {
        if (user) markSessionHeld()
    }, [user])

    useEffect(() => {
        // Harness-only: if a reproduce session is in progress, ReproduceBootstrap
        // will set cookies + reload imminently — don't racing-redirect to /setup
        // before it completes.
        if (HARNESS_ENABLED && typeof window !== 'undefined') {
            const url = new URL(window.location.href)
            if (url.searchParams.get('__reproduce')) return
        }
        // Demo mode: never bounce to /setup. isDemoMode() reads the #demo hash
        // (reliable on the first render after the hard-nav); persist it so later
        // navigations that drop the hash stay in demo mode.
        if (isDemoMode()) enableDemoMode()
        // no user has two causes. the user query returns null for a 401, and throws
        // for a 5xx or a network failure. so an error here means the backend is
        // down, not that the person is logged out. leave them on the error screen
        // below — a bounce to signup reads as "you are logged out" during an outage.
        if (isPublicPath) {
            // A session can expire while this tab is sitting on a public route.
            // Retire that tab-local provenance here without storing the public
            // route, so its next protected deep link is fresh intent.
            if (isReady && !isFetchingUser && !user && !userFetchError) consumeHeldSession()
            return undefined
        }
        if (isReady && !isFetchingUser && !user && !userFetchError && !isRedirecting.current && !isDemoMode()) {
            isRedirecting.current = true
            // Keep the target: a logged-out tap on a protected deep link
            // (/pay-request, /card, /receipt, every push) used to be dropped
            // here and land on /home after login. useLogin/useAccountSetup
            // consume this via consumePostAuthRedirect — which is why the
            // origin rides along: a fresh signup must not inherit the page a
            // previous session was standing on.
            saveRedirectUrl(consumeHeldSession() ? 'session-end' : 'deep-link')
            router.replace('/setup')
            // Hard-nav fallback if the soft nav silently fails; re-check at fire time.
            const fallback = setTimeout(() => {
                if (!isDemoMode()) window.location.replace('/setup')
            }, 3000)
            return () => clearTimeout(fallback)
        }
        return undefined
    }, [user, isFetchingUser, isReady, isPublicPath, userFetchError, router])

    // redirect logged-in users without peanut wallet account to complete setup
    const { needsRedirect, isCheckingAccount } = useAccountSetupRedirect()

    // show full-page offline screen when user is offline
    // only show after initialization to prevent flash on initial load
    // when connection is restored, page auto-reloads (no "back online" screen)
    if (isInitialized && !isOnline) {
        return <OfflineScreen />
    }

    // show backend error screen only when user fetch fails AND there's no cached user data
    // previously, a transient background refetch failure (e.g. refetchOnWindowFocus hitting
    // a network blip) would replace the entire app with the error screen even though
    // valid user data was still in the cache
    if (userFetchError && !isFetchingUser && !isPublicPath && !user) {
        return <BackendErrorScreen />
    }

    // For public paths, skip user loading and just show content when ready
    if (isPublicPath) {
        if (!isReady) {
            return (
                <div className="flex h-dvh w-full flex-col items-center justify-center">
                    <Loading variant="mascot" />
                </div>
            )
        }
    } else {
        // for protected paths, wait for auth to settle before rendering
        if (!isReady || isFetchingUser || !user || isCheckingAccount || needsRedirect) {
            return (
                <div className="flex h-dvh w-full flex-col items-center justify-center">
                    <Loading variant="mascot" />
                </div>
            )
        }
    }

    // PWA sunset: past the cutover the web app is switched off — download the
    // native app is the only way forward (keep-web cookie bypasses, public
    // guest links keep working). Must precede the PWA-install and waitlist
    // screens: the web is gone either way.
    if (shouldShowSunsetBlock({ migrationOn, hasKeepWebBypass, isPublic: isPublicPath })) {
        return <SunsetScreen />
    }

    // After setup flow is completed, show ios pwa install screen if not in pwa
    if (!isPublicPath && showIosPwaInstallScreen) {
        return <ForceIOSPWAInstall />
    }

    // Show waitlist page if user doesn't have app access
    if (!isFetchingUser && user && !user?.user.hasAppAccess && !isPublicPath) {
        return <JoinWaitlistPage />
    }

    return (
        <NavHeaderPresenceProvider>
            <AppShell
                variant="app"
                banner={!isDev && <ShellBannerFallback />}
                nav={!isDev && !isProfileMenu && isUserLoggedIn && <BottomNav />}
                contentClassName={twMerge(
                    'pb-[calc(6rem_+_var(--safe-bottom))]',
                    isSupport && 'p-0 pb-[calc(5rem_+_var(--safe-bottom))]',
                    isHome && 'p-0',
                    // Receipt owns its 16px page inset so the same shell also
                    // renders correctly on the public web receipt route.
                    isReceipt && 'p-0',
                    // the 6rem reservation exists to clear the bottom nav, so a
                    // screen without one takes the same inset as a logged-out one
                    isUserLoggedIn && !isProfileMenu
                        ? 'pb-[calc(6rem_+_var(--safe-bottom))]'
                        : 'pb-[calc(1rem_+_var(--safe-bottom))]',
                    isDev && 'p-0 pb-0',
                    isHome && isCapacitor() && 'px-0 pt-0'
                )}
                innerClassName={twMerge(
                    alignStart && 'items-start',
                    isSupport && 'h-full',
                    isUserLoggedIn
                        ? 'min-h-[calc(100dvh_-_160px_-_var(--safe-top)_-_var(--safe-bottom))]'
                        : 'min-h-[calc(100dvh_-_64px_-_var(--safe-top)_-_var(--safe-bottom))]',
                    isDev && 'max-w-full min-h-dvh items-start justify-start'
                )}
                modals={
                    <>
                        <GuestLoginModal />
                        <ReConsentModal />
                        <SupportDrawer />
                        {/* Suspense is required: nuqs reads useSearchParams, which triggers
                        a client-side-rendering bailout without a boundary. */}
                        <Suspense fallback={null}>
                            <SupportDeepLink />
                        </Suspense>
                        <QRScannerOverlay />
                        <SecurityVerificationOverlay />
                        {/* dev fixture warning strip — renders null outside fixture mode */}
                        <FixtureBanner />
                    </>
                }
            >
                {children}
            </AppShell>
        </NavHeaderPresenceProvider>
    )
}

export default Layout
