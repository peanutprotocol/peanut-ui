'use client'

import GuestLoginModal from '@/components/Global/GuestLoginModal'
import PeanutLoading from '@/components/Global/PeanutLoading'
import TopNavbar from '@/components/Global/TopNavbar'
import WalletNavigation from '@/components/Global/WalletNavigation'
import OfflineScreen from '@/components/Global/OfflineScreen'
import BackendErrorScreen from '@/components/Global/BackendErrorScreen'
import { useAuth } from '@/context/authContext'
import classNames from 'classnames'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import '../../styles/globals.css'
import QRScannerOverlay from '@/components/Global/QRScannerOverlay'
import SecurityVerificationOverlay from '@/components/Global/SecurityVerificationOverlay'
import SupportDrawer from '@/components/Global/SupportDrawer'
import JoinWaitlistPage from '@/components/Invites/JoinWaitlistPage'
import { useRouter } from 'next/navigation'
import { Banner } from '@/components/Global/Banner'
import { useSetupStore } from '@/redux/hooks'
import ForceIOSPWAInstall from '@/components/ForceIOSPWAInstall'
import { isPublicRoute } from '@/constants/routes'
import { IS_DEV } from '@/constants/general.consts'
import { HARNESS_ENABLED } from '@/constants/harness.consts'
import { usePullToRefresh } from '@/hooks/usePullToRefresh'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import { useAccountSetupRedirect } from '@/hooks/useAccountSetupRedirect'
import { useNativePlugins } from '@/hooks/useNativePlugins'
// Side-effect import: useSafeBack patches history.pushState at module load. Importing here
// guarantees the patch is installed before any child page's mount-time router.push.
import '@/hooks/useSafeBack'
import { isCapacitor } from '@/utils/capacitor'
import { isDemoMode, enableDemoMode } from '@/utils/demo'

const Layout = ({ children }: { children: React.ReactNode }) => {
    useNativePlugins()
    const pathName = usePathname()

    // Allow access to public paths without authentication
    // Dev test pages (gift-test, shake-test) are only public in dev mode
    const isPublicPath = isPublicRoute(pathName, IS_DEV)

    const { isFetchingUser, user, userFetchError } = useAuth()
    const [isReady, setIsReady] = useState(false)
    const isUserLoggedIn = !!user?.user.userId || false
    const isHome = pathName === '/home' || pathName === '/home/'
    const isHistory = pathName === '/history'
    const isSupport = pathName === '/support'
    const isDev = pathName?.startsWith('/dev') ?? false
    const alignStart = isHome || isHistory || isSupport
    const router = useRouter()
    const { showIosPwaInstallScreen } = useSetupStore()

    // detect online/offline status for full-page offline screen
    const { isOnline, isInitialized } = useNetworkStatus()

    // cache the scrollable content element to avoid DOM queries on every scroll event
    const scrollableContentRef = useRef<Element | null>(null)

    useEffect(() => {
        setIsReady(true)
    }, [])

    // memoizing shouldPullToRefresh callback to prevent re-initialization on every render
    // lazy-load element ref to ensure DOM is ready
    const shouldPullToRefresh = useCallback(() => {
        // window must be at the top first
        if (window.scrollY > 0) {
            return false
        }

        // lazy-load the element reference if not cached yet
        if (!scrollableContentRef.current) {
            scrollableContentRef.current = document.querySelector('#scrollable-content')
        }

        const scrollableContent = scrollableContentRef.current
        if (!scrollableContent) {
            // if element not found, window check already passed above
            return true
        }

        // scrollable content must also be at the top
        return scrollableContent.scrollTop === 0
    }, [])

    // enable pull-to-refresh for both ios and android
    usePullToRefresh({ shouldPullToRefresh })

    const isRedirecting = useRef(false)

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
        if (!isPublicPath && isReady && !isFetchingUser && !user && !isRedirecting.current && !isDemoMode()) {
            isRedirecting.current = true
            router.replace('/setup')
            // Hard-nav fallback if the soft nav silently fails; re-check at fire time.
            const fallback = setTimeout(() => {
                if (!isDemoMode()) window.location.replace('/setup')
            }, 3000)
            return () => clearTimeout(fallback)
        }
        return undefined
    }, [user, isFetchingUser, isReady, isPublicPath, router])

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
                <div className="flex h-[100dvh] w-full flex-col items-center justify-center">
                    <PeanutLoading />
                </div>
            )
        }
    } else {
        // for protected paths, wait for auth to settle before rendering
        if (!isReady || isFetchingUser || !user || isCheckingAccount || needsRedirect) {
            return (
                <div className="flex h-[100dvh] w-full flex-col items-center justify-center">
                    <PeanutLoading />
                </div>
            )
        }
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
        <div className="flex min-h-[100dvh] w-full bg-background" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
            {/* Wrapper div for desktop layout */}
            <div className="flex w-full">
                {/* Sidebar - Fixed on desktop */}

                {!isDev && (
                    <div className="hidden md:block">
                        <div className="fixed left-0 top-0 z-20 h-screen w-64">
                            <WalletNavigation />
                        </div>
                    </div>
                )}

                {/* Main content area */}
                <div className="flex w-full flex-1 flex-col">
                    {/* Banner component handles maintenance and feedback banners */}
                    {!isDev && <Banner />}

                    {/* Fixed top navbar */}

                    {!isDev && (
                        <div className="sticky top-0 z-10 w-full">
                            <TopNavbar />
                        </div>
                    )}

                    {/* Scrollable content area */}
                    <div
                        id="scrollable-content"
                        className={classNames(
                            twMerge(
                                'relative flex-1 overflow-y-auto bg-background p-6 pb-[calc(6rem_+_env(safe-area-inset-bottom))] md:pb-6',
                                !!isSupport && 'p-0 pb-[calc(5rem_+_env(safe-area-inset-bottom))] md:p-6',
                                !!isHome && 'p-0 md:p-6 md:pr-0',
                                isUserLoggedIn
                                    ? 'pb-[calc(6rem_+_env(safe-area-inset-bottom))]'
                                    : 'pb-[calc(1rem_+_env(safe-area-inset-bottom))]',
                                isDev && 'p-0 pb-0',
                                isHome && isCapacitor() && 'px-0 pt-0'
                            )
                        )}
                    >
                        <div
                            className={twMerge(
                                'flex w-full items-center justify-center md:ml-auto md:w-[calc(100%_-_160px)]',
                                alignStart && 'items-start',
                                isSupport && 'h-full',
                                isUserLoggedIn
                                    ? 'min-h-[calc(100dvh_-_160px_-_env(safe-area-inset-top)_-_env(safe-area-inset-bottom))]'
                                    : 'min-h-[calc(100dvh_-_64px_-_env(safe-area-inset-top)_-_env(safe-area-inset-bottom))]',
                                isDev && 'min-h-[100dvh] items-start justify-start md:ml-0 md:w-full'
                            )}
                        >
                            {children}
                        </div>
                    </div>

                    {/* Mobile navigation */}
                    {!isDev && (
                        <div
                            className="fixed bottom-0 left-0 right-0 z-10 bg-background md:hidden"
                            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
                        >
                            <WalletNavigation />
                        </div>
                    )}
                </div>
            </div>

            {/* Modal */}
            <GuestLoginModal />

            <SupportDrawer />

            <QRScannerOverlay />

            <SecurityVerificationOverlay />
        </div>
    )
}

export default Layout
