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
import PullToRefresh from 'pulltorefreshjs'
import { useEffect, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import '../../styles/globals.css'
import SupportDrawer from '@/components/Global/SupportDrawer'
import JoinWaitlistPage from '@/components/Invites/JoinWaitlistPage'
import { useRouter } from 'next/navigation'
import { Banner } from '@/components/Global/Banner'
import { DeviceType, useDeviceType } from '@/hooks/useGetDeviceType'
import { useSetupStore } from '@/redux/hooks'
import ForceIOSPWAInstall from '@/components/ForceIOSPWAInstall'
import { PUBLIC_ROUTES_REGEX } from '@/constants/routes'

const Layout = ({ children }: { children: React.ReactNode }) => {
    const pathName = usePathname()
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

    // pull-to-refresh enabled on both ios and android with hidden indicator
    // docs here: https://github.com/BoxFactura/pulltorefresh.js
    useEffect(() => {
        if (typeof window === 'undefined') return

        // initialize pull-to-refresh on mobile devices (ios and android)
        if (detectedDeviceType === DeviceType.WEB) return

        PullToRefresh.init({
            mainElement: 'body',
            onRefresh: () => {
                window.location.reload()
            },
            instructionsPullToRefresh: '',
            instructionsReleaseToRefresh: '',
            instructionsRefreshing: '',
            shouldPullToRefresh: () => {
                const el = document.querySelector('body')
                if (!el) return false

                return el.scrollTop === 0 && window.scrollY === 0
            },
            distThreshold: 70,
            distMax: 120,
            distReload: 80,
        })

        return () => {
            PullToRefresh.destroyAll()
        }
    }, [detectedDeviceType])

    // Allow access to public paths without authentication
    const isPublicPath = PUBLIC_ROUTES_REGEX.test(pathName)

    useEffect(() => {
        if (!isPublicPath && !isFetchingUser && !user) {
            router.push('/setup')
        }
    }, [user, isFetchingUser])

    if (!isReady || isFetchingUser || (!hasToken && !isPublicPath) || (!isPublicPath && !user)) {
        return (
            <div className="flex h-[100dvh] w-full flex-col items-center justify-center">
                <PeanutLoading />
            </div>
        )
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
