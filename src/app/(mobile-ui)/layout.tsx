'use client'

import '../../styles/globals.bruddle.css'
import { Button, NavIcons, NavIconsName } from '@/components/0_Bruddle'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import Modal from '@/components/Global/Modal'
import { useWallet } from '@/context/walletContext'
import { useZeroDev } from '@/context/walletContext/zeroDevContext.context'
import { usePathname } from 'next/navigation'
import classNames from 'classnames'
import Icon from '@/components/Global/Icon'
import { useRouter } from 'next/navigation'
import WalletToggleButton from '@/components/Home/WalletToggleButton'

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

const Layout = ({ children }: { children: React.ReactNode }) => {
    const pathName = usePathname()
    const { back } = useRouter()
    const [isReady, setIsReady] = useState(false)
    const { signInModal, selectedWallet, walletColor } = useWallet()
    const { handleLogin, isLoggingIn } = useZeroDev()

    useEffect(() => {
        setIsReady(true)
    }, [])

    if (!isReady) return null

    const isHome = pathName === '/home'
    const pageDefinition = pages.find((page) => page.href === pathName)

    return (
        <div className="flex h-screen flex-col">
            {!isHome && (
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
                className={classNames('flex w-full flex-1 overflow-x-visible overflow-y-scroll', {
                    'p-4': !isHome,
                })}
                style={{
                    backgroundColor: walletColor,
                }}
            >
                {children}
            </div>
            <div className="grid grid-cols-5 border-t-2 border-black p-2">
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
            <Modal
                visible={signInModal.visible}
                onClose={() => {
                    signInModal.close()
                }}
                title={'Sign In with your Peanut Wallet'}
            >
                <div className="flex flex-col gap-2 p-5">
                    <p>
                        Selected Wallet: <span className="font-bold">{selectedWallet?.handle}.peanut.wallet</span>
                    </p>
                    <Button
                        loading={isLoggingIn}
                        disabled={isLoggingIn}
                        onClick={() => {
                            if (!selectedWallet) return
                            const { handle } = selectedWallet
                            handleLogin(handle)
                        }}
                    >
                        Sign In
                    </Button>
                </div>
            </Modal>
        </div>
    )
}

export default Layout
