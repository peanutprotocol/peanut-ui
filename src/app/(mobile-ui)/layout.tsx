'use client'

import GuestLoginModal from '@/components/Global/GuestLoginModal'
import PeanutLoading from '@/components/Global/PeanutLoading'
import TopNavbar from '@/components/Global/TopNavbar'
import WalletNavigation from '@/components/Global/WalletNavigation'
import { ThemeProvider } from '@/config'
import { useAuth } from '@/context/authContext'
import { hasValidJwtToken } from '@/utils/auth'
import classNames from 'classnames'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import '../../styles/globals.css'
import SupportDrawer from '@/components/Global/SupportDrawer'
import JoinWaitlistPage from '@/components/Invites/JoinWaitlistPage'
import { useRouter } from 'next/navigation'
import { Banner } from '@/components/Global/Banner'
import { useDeviceType } from '@/hooks/useGetDeviceType'
import { useSetupStore } from '@/redux/hooks'
import ForceIOSPWAInstall from '@/components/ForceIOSPWAInstall'
import { PUBLIC_ROUTES_REGEX } from '@/constants/routes'
import { usePullToRefresh } from '@/hooks/usePullToRefresh'

const Layout = ({ children }: { children: React.ReactNode }) => {
    const pathName = usePathname()

    // Allow access to public paths without authentication
    const isPublicPath = PUBLIC_ROUTES_REGEX.test(pathName)

    const { isFetchingUser, user } = useAuth()
    const [isReady, setIsReady] = useState(false)
    const [hasToken, setHasToken] = useState(false)
    const isUserLoggedIn = !!user?.user.userId || false
    const isHome = pathName === '/home'
    const isHistory = pathName === '/history'
    const isSupport = pathName === '/support'
    const alignStart = isHome || isHistory || isSupport
    const router = useRouter()
    const { deviceType: detectedDeviceType } = useDeviceType()
    const { showIosPwaInstallScreen } = useSetupStore()

    useEffect(() => {
        // check for JWT token
        setHasToken(hasValidJwtToken())

        setIsReady(true)
    }, [])

    // memoizing shouldPullToRefresh callback to prevent re-initialization on every render
    // @dev: note this fixes the issue where scrolling scolling a long list would trigger pull-to-refresh
    const shouldPullToRefresh = useCallback(() => {
        // check if the scrollable content container is at the top
        const scrollableContent = document.querySelector('#scrollable-content')
        if (!scrollableContent) return false

        // only allow pull-to-refresh when the scrollable container is at the very top
        return scrollableContent.scrollTop === 0
    }, [])

    // enable pull-to-refresh for both ios and android
    usePullToRefresh({ shouldPullToRefresh })

    useEffect(() => {
        if (!isPublicPath && !isFetchingUser && !user) {
            router.push('/setup')
        }
    }, [user, isFetchingUser])

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
        // For protected paths, wait for user auth
        if (!isReady || isFetchingUser || !hasToken || !user) {
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

                <div className="hidden md:block">
                    <div className="fixed left-0 top-0 z-20 h-screen w-64">
                        <WalletNavigation />
                    </div>
                </div>

                {/* Main content area */}
                <div className="flex w-full flex-1 flex-col">
                    {/* Banner component handles maintenance and feedback banners */}
                    <Banner />

                    {/* Fixed top navbar */}

                    <div className="sticky top-0 z-10 w-full">
                        <TopNavbar />
                    </div>

                    {/* Scrollable content area */}
                    <div
                        id="scrollable-content"
                        className={classNames(
                            twMerge(
                                'relative flex-1 overflow-y-auto bg-background p-6 pb-24 md:pb-6',
                                !!isSupport && 'p-0 pb-20 md:p-6',
                                !!isHome && 'p-0 md:p-6 md:pr-0',
                                isUserLoggedIn ? 'pb-24' : 'pb-6'
                            )
                        )}
                    >
                        <ThemeProvider>
                            <div
                                className={twMerge(
                                    'flex w-full items-center justify-center md:ml-auto md:w-[calc(100%-160px)]',
                                    alignStart && 'items-start',
                                    isSupport && 'h-full',
                                    isUserLoggedIn ? 'min-h-[calc(100dvh-160px)]' : 'min-h-[calc(100dvh-64px)]'
                                )}
                            >
                                {children}
                            </div>
                        </ThemeProvider>
                    </div>

                    {/* Mobile navigation */}
                    <div className="fixed bottom-0 left-0 right-0 z-10 bg-background md:hidden">
                        <WalletNavigation />
                    </div>
                </div>
            </div>

            {/* Modal */}
            <GuestLoginModal />

            <SupportDrawer />
        </div>
    )
}

export default Layout
