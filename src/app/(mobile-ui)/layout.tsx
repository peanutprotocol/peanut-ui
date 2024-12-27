'use client'

import { Button, NavIcons, NavIconsName } from '@/components/0_Bruddle'
import CloudsBackground from '@/components/0_Bruddle/CloudsBackground'
import { useToast } from '@/components/0_Bruddle/Toast'
import Icon from '@/components/Global/Icon'
import Modal from '@/components/Global/Modal'
import HomeWaitlist from '@/components/Home/HomeWaitlist'
import WalletToggleButton from '@/components/Home/WalletToggleButton'
import { peanutWalletIsInPreview } from '@/constants'
import { useAuth } from '@/context/authContext'
import { useWallet } from '@/context/walletContext'
import { useZeroDev } from '@/context/walletContext/zeroDevContext.context'
import { colorMap } from '@/utils'
import { useAppKit } from '@reown/appkit/react'
import classNames from 'classnames'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import '../../styles/globals.bruddle.css'

type ScreenProps = {
    name: string
    href: string
}

type NavTabProps = ScreenProps & {
    icon: NavIconsName
}

/**
 * Soft definitions of pages use to have page titles in header
 * Note: nextjs might hold this information somewhere, need to check
 */
const pages: ScreenProps[] = [
    {
        name: 'Points',
        href: '/points',
    },
    {
        name: 'Send',
        href: '/send',
    },
    {
        name: 'Receive',
        href: '/receive',
    },
    {
        name: 'Profile',
        href: '/profile',
    },
    {
        name: 'History',
        href: '/history',
    },
    {
        name: 'Settings',
        href: '/settings',
    },
    {
        name: 'Cashout',
        href: '/cashout',
    },
    {
        name: 'Request',
        href: '/request/create',
    },
    {
        name: 'Support',
        href: '/support',
    },
]

const tabs: NavTabProps[] = [
    {
        name: 'Home',
        href: '/home',
        icon: 'home',
    },
    {
        name: 'Wallet',
        href: '/wallet',
        icon: 'wallet',
    },
    {
        name: 'History',
        href: '/history',
        icon: 'history',
    },
    {
        name: 'Settings',
        href: '/profile',
        icon: 'settings',
    },
    {
        name: 'Support',
        href: '/support',
        icon: 'support',
    },
]

const publicPathRegex = /^\/(request\/pay|claim)/

const Layout = ({ children }: { children: React.ReactNode }) => {
    const pathName = usePathname()
    const { back } = useRouter()
    const [isReady, setIsReady] = useState(false)
    const { signInModal, selectExternalWallet } = useWallet()
    const web3Modal = useAppKit()
    const { user } = useAuth()
    const { handleLogin, isLoggingIn } = useZeroDev()
    const toast = useToast()

    useEffect(() => {
        setIsReady(true)
    }, [])

    const isHome = pathName === '/home'
    const pageDefinition = pages.find((page) => page.href === pathName)
    const showFullPeanutWallet = useMemo(() => {
        const isPublicPath = publicPathRegex.test(pathName)
        return isPublicPath || (user?.user.hasPwAccess ?? false) || !peanutWalletIsInPreview
    }, [user, pathName])

    if (!isReady) return null
    return (
        <div
            className="flex h-screen flex-col"
            style={{
                backgroundColor: colorMap.lavender,
                height: '100vh',
            }}
        >
            <CloudsBackground />
            {showFullPeanutWallet && !isHome && (
                <div className="flex min-h-[64px] flex-row items-center border-b-2 border-black p-4">
                    <div
                        className="absolute left-2"
                        onClick={() => {
                            back()
                        }}
                    >
                        <Icon name="arrow-prev" className="h-[30px] w-[30px]" />
                    </div>
                    <div className="h-full flex-grow text-center">
                        {pageDefinition && <p className="text-lg font-bold">{pageDefinition.name}</p>}
                    </div>
                </div>
            )}
            <div
                className={classNames('z-1 flex w-full flex-1 overflow-x-visible overflow-y-scroll', {
                    'p-4': !isHome,
                })}
            >
                {showFullPeanutWallet ? children : <HomeWaitlist />}
            </div>
            {showFullPeanutWallet && (
                <div className="z-1 grid grid-cols-5 border-t-2 border-black p-2">
                    {tabs.map((tab) => {
                        if (tab.icon === 'wallet') {
                            return <WalletToggleButton />
                        }

                        return (
                            <Link
                                href={tab.href}
                                key={tab.name}
                                className={classNames('flex flex-row justify-center py-2 hover:cursor-pointer ', {
                                    'text-purple-1': pathName === tab.href,
                                })}
                            >
                                <NavIcons name={tab.icon} size={30} />
                            </Link>
                        )
                    })}
                </div>
            )}
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
                    <Link href={'/setup'} className="text-h8 hover:underline">
                        Don't have a penanut wallet? Get one now.
                    </Link>
                    <div className="my-2 flex w-full items-center gap-4">
                        <div className="h-px flex-1 bg-gray-200" />
                        <span className="text-sm text-gray-500">or</span>
                        <div className="h-px flex-1 bg-gray-200" />
                    </div>
                    <Button
                        loading={isLoggingIn}
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
