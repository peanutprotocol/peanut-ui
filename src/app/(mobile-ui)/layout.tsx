'use client'

import GuestLoginModal from '@/components/Global/GuestLoginModal'
import PeanutLoading from '@/components/Global/PeanutLoading'
import TopNavbar from '@/components/Global/TopNavbar'
import WalletNavigation from '@/components/Global/WalletNavigation'
import OfflineScreen from '@/components/Global/OfflineScreen'
import BackendErrorScreen from '@/components/Global/BackendErrorScreen'
import { ThemeProvider } from '@/config'
import { useAuth } from '@/context/authContext'
import classNames from 'classnames'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import '../../styles/globals.css'
import SupportDrawer from '@/components/Global/SupportDrawer'
import JoinWaitlistPage from '@/components/Invites/JoinWaitlistPage'
import { useRouter } from 'next/navigation'
import { Banner } from '@/components/Global/Banner'
import { useSetupStore } from '@/redux/hooks'
import ForceIOSPWAInstall from '@/components/ForceIOSPWAInstall'
import { isPublicRoute } from '@/constants/routes'
import { IS_DEV } from '@/constants/general.consts'
import { usePullToRefresh } from '@/hooks/usePullToRefresh'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import { useAccountSetupRedirect } from '@/hooks/useAccountSetupRedirect'

const Layout = ({ children }: { children: React.ReactNode }) => {
    const pathName = usePathname()

    // Allow access to public paths without authentication
    // Dev test pages (gift-test, shake-test) are only public in dev mode
    const isPublicPath = isPublicRoute(pathName, IS_DEV)

    const { isFetchingUser, user, userFetchError } = useAuth()
    const [isReady, setIsReady] = useState(false)
    const isUserLoggedIn = !!user?.user.userId || false
    const isHome = pathName === '/home'
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
        if (!isPublicPath && isReady && !isFetchingUser && !user && !isRedirecting.current) {
            isRedirecting.current = true
            router.replace('/setup')
            // hard navigation fallback in case soft navigation silently fails
            const fallback = setTimeout(() => {
                window.location.replace('/setup')
            }, 3000)
            return () => clearTimeout(fallback)
        }
    }, [user, isFetchingUser, isReady, isPublicPath, router])

    // redirect logged-in users without peanut wallet account to complete setup
    const { needsRedirect, isCheckingAccount } = useAccountSetupRedirect()

    // show full-page offline screen when user is offline
    // only show after initialization to prevent flash on initial load
    // when connection is restored, page auto-reloads (no "back online" screen)
    if (isInitialized && !isOnline) {
        return <OfflineScreen />
    }

    // show backend error screen when user fetch fails after retries
    // user can retry or force logout to clear stale state
    if (userFetchError && !isFetchingUser && !isPublicPath) {
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
        <div className="flex min-h-[100dvh] w-full bg-background">
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
                                'relative flex-1 overflow-y-auto bg-background p-6 pb-24 md:pb-6',
                                !!isSupport && 'p-0 pb-20 md:p-6',
                                !!isHome && 'p-0 md:p-6 md:pr-0',
                                isUserLoggedIn ? 'pb-24' : 'pb-4',
                                isDev && 'p-0 pb-0'
                            )
                        )}
                    >
                        <ThemeProvider>
                            <div
                                className={twMerge(
                                    'flex w-full items-center justify-center md:ml-auto md:w-[calc(100%-160px)]',
                                    alignStart && 'items-start',
                                    isSupport && 'h-full',
                                    isUserLoggedIn ? 'min-h-[calc(100dvh-160px)]' : 'min-h-[calc(100dvh-64px)]',
                                    isDev && 'min-h-[100dvh] items-start justify-start md:ml-0 md:w-full'
                                )}
                            >
                                {children}
                            </div>
                        </ThemeProvider>
                    </div>

                    {/* Mobile navigation */}
                    {!isDev && (
                        <div className="fixed bottom-0 left-0 right-0 z-10 bg-background md:hidden">
                            <WalletNavigation />
                        </div>
                    )}
                </div>
            </div>

            {/* Modal */}
            <GuestLoginModal />

            <SupportDrawer />
        </div>
    )
}

export default Layout
