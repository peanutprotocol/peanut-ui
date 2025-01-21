'use client'

import { Button } from '@/components/0_Bruddle'
import { useToast } from '@/components/0_Bruddle/Toast'
import Modal from '@/components/Global/Modal'
import TopNavbar from '@/components/Global/TopNavbar'
import WalletNavigation from '@/components/Global/WalletNavigation'
import HomeWaitlist from '@/components/Home/HomeWaitlist'
import { ThemeProvider } from '@/config'
import { peanutWalletIsInPreview } from '@/constants'
import { useAuth } from '@/context/authContext'
import { useZeroDev } from '@/hooks/useZeroDev'
import { useWallet } from '@/hooks/wallet/useWallet'
import { useAppKit } from '@reown/appkit/react'
import classNames from 'classnames'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import '../../styles/globals.css'

const publicPathRegex = /^\/(request\/pay|claim)/

const Layout = ({ children }: { children: React.ReactNode }) => {
    const pathName = usePathname()
    const [isReady, setIsReady] = useState(false)
    const { signInModal, selectExternalWallet } = useWallet()
    const web3Modal = useAppKit()
    const { user, isFetchingUser } = useAuth()
    const { handleLogin, isLoggingIn } = useZeroDev()
    const toast = useToast()

    useEffect(() => {
        setIsReady(true)
    }, [])

    const isHome = pathName === '/home'
    const isHistory = pathName === '/history'
    const isWallet = pathName === '/wallet'
    const isSupport = pathName === '/support'
    const alignStart = isHome || isHistory || isWallet || isSupport

    const showFullPeanutWallet = useMemo(() => {
        const isPublicPath = publicPathRegex.test(pathName)
        return isPublicPath || (user?.user.hasPwAccess ?? false) || !peanutWalletIsInPreview
    }, [user, pathName])

    if (!isReady) return null
    return (
        <div className="flex h-screen w-full bg-background">
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
                    {/* Fixed top navbar */}
                    {showFullPeanutWallet && (
                        <div className="sticky top-0 z-10 w-full">
                            <TopNavbar />
                        </div>
                    )}

                    {/* Scrollable content area */}
                    <div
                        className={classNames(
                            twMerge(
                                'flex-1 overflow-y-auto bg-background p-6 pb-24 md:pb-6',
                                !!isSupport && 'p-0 pb-20 md:p-6'
                            )
                        )}
                    >
                        <ThemeProvider>
                            {showFullPeanutWallet ? (
                                <div
                                    className={twMerge(
                                        'flex min-h-[calc(100dvh-160px)] w-full items-center justify-center md:ml-auto md:min-h-full  md:w-[calc(100%-256px)]',
                                        alignStart && 'items-start',
                                        isSupport && 'h-full'
                                    )}
                                >
                                    {children}
                                </div>
                            ) : (
                                <HomeWaitlist />
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
            <Modal
                visible={signInModal.visible}
                onClose={() => {
                    signInModal.close()
                }}
                title={'Sign In with your Peanut Wallet'}
            >
                <div className="flex flex-col items-center gap-2 p-5">
                    <Button
                        loading={isLoggingIn}
                        disabled={isLoggingIn}
                        onClick={() => {
                            handleLogin()
                                .then(signInModal.close)
                                .catch((e) => {
                                    console.error(e)
                                    toast.error('Error logging in')
                                })
                        }}
                    >
                        Sign In
                    </Button>
                    <Link href={'/setup'} className="text-h8 underline">
                        Don't have a peanut wallet? Get one now.
                    </Link>
                    <div className="my-2 flex w-full items-center gap-4">
                        <div className="h-px flex-1 bg-gray-200" />
                        <span className="text-sm text-gray-500">or</span>
                        <div className="h-px flex-1 bg-gray-200" />
                    </div>
                    <Button
                        disabled={isLoggingIn}
                        variant="dark"
                        shadowType="secondary"
                        onClick={() => {
                            web3Modal
                                .open()
                                .then(selectExternalWallet)
                                .catch((e) => {
                                    console.error(e)
                                    toast.error('Error connecting wallet')
                                })
                                .finally(signInModal.close)
                        }}
                    >
                        Connect External Wallet
                    </Button>
                </div>
            </Modal>
        </div>
    )
}

export default Layout
