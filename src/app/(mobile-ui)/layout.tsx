'use client'

import { MarqueeWrapper } from '@/components/Global/MarqueeWrapper'
import { useRouter } from 'next/navigation'
import { HandThumbsUp } from '@/assets'
import Image from 'next/image'
import GuestLoginModal from '@/components/Global/GuestLoginModal'
import PeanutLoading from '@/components/Global/PeanutLoading'
import TopNavbar from '@/components/Global/TopNavbar'
import WalletNavigation from '@/components/Global/WalletNavigation'
import HomeWaitlist from '@/components/Home/HomeWaitlist'
import { ThemeProvider } from '@/config'
import { peanutWalletIsInPreview } from '@/constants'
import { useAuth } from '@/context/authContext'
import { hasValidJwtToken } from '@/utils/auth'
import { isIOS } from '@/utils/general.utils'
import classNames from 'classnames'
import { usePathname } from 'next/navigation'
import PullToRefresh from 'pulltorefreshjs'
import { useEffect, useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import '../../styles/globals.css'

const publicPathRegex = /^\/(request\/pay|claim|pay\/.+$)/

const Layout = ({ children }: { children: React.ReactNode }) => {
    const pathName = usePathname()
    const router = useRouter()
    const { isFetchingUser, user } = useAuth()
    const [isReady, setIsReady] = useState(false)
    const [hasToken, setHasToken] = useState(false)
    const isUserLoggedIn = !!user?.user.userId || false

    const isHome = pathName === '/home'
    const isHistory = pathName === '/history'
    const isSupport = pathName === '/support'
    const alignStart = isHome || isHistory || isSupport

    const showFullPeanutWallet = useMemo(() => {
        const isPublicPath = publicPathRegex.test(pathName)
        return isPublicPath || (user?.user.hasPwAccess ?? false) || !peanutWalletIsInPreview
    }, [user, pathName])

    useEffect(() => {
        // check for JWT token
        setHasToken(hasValidJwtToken())

        setIsReady(true)
    }, [])

    // Pull-to-refresh is only enabled on iOS devices since Android has native pull-to-refresh
    // docs here: https://github.com/BoxFactura/pulltorefresh.js
    useEffect(() => {
        if (typeof window === 'undefined') return

        // Only initialize pull-to-refresh on iOS devices
        if (!isIOS()) return

        PullToRefresh.init({
            mainElement: 'body',
            onRefresh: () => {
                window.location.reload()
            },
            instructionsPullToRefresh: 'Pull down to refresh',
            instructionsReleaseToRefresh: 'Release to refresh',
            instructionsRefreshing: 'Refreshing...',
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
    }, [])

    if (!isReady || (isFetchingUser && !user && !hasToken)) {
        return (
            <div className="flex h-[100dvh] w-full flex-col items-center justify-center">
                <PeanutLoading />
            </div>
        )
    }

    return (
        <div className="flex min-h-[100dvh] w-full bg-background">
            {/* Wrapper div for desktop layout */}
            <div className="flex w-full">
                {/* Sidebar - Fixed on desktop */}
                {showFullPeanutWallet && (
                    <div className="hidden md:block">
                        <div className="fixed left-0 top-0 z-20 h-screen w-64">
                            <WalletNavigation />
                        </div>
                    </div>
                )}

                {/* Main content area */}
                <div className="flex w-full flex-1 flex-col">
                    {/* Only show banner if not on landing page */}
                    {pathName !== '/' && (
                        <button onClick={() => router.push('/support')} className="w-full cursor-pointer">
                            <MarqueeWrapper backgroundColor="bg-primary-1" direction="left">
                                <span className="z-10 mx-4 flex items-center gap-2 text-sm font-semibold">
                                    Peanut is in beta! Thank you for being an early user, share your feedback here
                                    <Image src={HandThumbsUp} alt="Thumbs up" className="h-4 w-4" />
                                </span>
                            </MarqueeWrapper>
                        </button>
                    )}
                    {/* Fixed top navbar */}
                    {showFullPeanutWallet && (
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
                                isUserLoggedIn ? 'pb-24' : 'pb-6'
                            )
                        )}
                    >
                        <ThemeProvider>
                            {showFullPeanutWallet ? (
                                <div
                                    className={twMerge(
                                        'flex w-full items-center justify-center md:ml-auto md:min-h-full md:w-[calc(100%-160px)]',
                                        alignStart && 'items-start',
                                        isSupport && 'h-full',
                                        isUserLoggedIn ? 'min-h-[calc(100dvh-160px)]' : 'min-h-[calc(100dvh-64px)]'
                                    )}
                                >
                                    {children}
                                </div>
                            ) : (
                                <div className="flex h-full items-center justify-center self-center">
                                    <HomeWaitlist />
                                </div>
                            )}
                        </ThemeProvider>
                    </div>

                    {/* Mobile navigation */}
                    {showFullPeanutWallet && (
                        <div className="fixed bottom-0 left-0 right-0 z-10 bg-background md:hidden">
                            <WalletNavigation />
                        </div>
                    )}
                </div>
            </div>

            {/* Modal */}
            <GuestLoginModal />
        </div>
    )
}

export default Layout
