'use client'

import '../../styles/globals.bruddle.css'
import { Button, NavIcons, NavIconsName } from '@/components/0_Bruddle'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import HomeNav from '@/components/Home/HomeNav'
import Modal from '@/components/Global/Modal'
import { useWallet } from '@/context/walletContext'
import { useZeroDev } from '@/context/walletContext/zeroDevContext.context'
import { usePathname } from 'next/navigation'
import classNames from 'classnames'

type NavTabProps = {
    name: string
    href: string
    icon: NavIconsName
}

const tabs: NavTabProps[] = [
    {
        name: 'Home',
        href: '/home',
        icon: 'home',
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
]

const Layout = ({ children }: { children: React.ReactNode }) => {
    const pathName = usePathname()
    const [isReady, setIsReady] = useState(false)
    const { signInModal, selectedWallet } = useWallet()
    const { handleLogin, isLoggingIn } = useZeroDev()

    useEffect(() => {
        setIsReady(true)
    }, [])

    if (!isReady) return null

    return (
        <div className="flex h-screen flex-col">
            <HomeNav />
            <div className="flex w-full flex-1 overflow-x-visible overflow-y-scroll p-4">{children}</div>
            <div className="grid grid-cols-3 border-t-2 border-black p-2">
                {tabs.map((tab) => (
                    <Link
                        href={tab.href}
                        key={tab.name}
                        className={classNames("flex flex-row justify-center py-2 hover:cursor-pointer ", {
                            "text-purple-1": pathName === tab.href,
                        })}
                    >
                        <NavIcons name={tab.icon} size={30} />
                    </Link>
                ))}
            </div>
            <Modal visible={signInModal.visible} onClose={() => {
                signInModal.close()
            }} title={"Sign In with your Peanut Wallet"}>
                <div className="p-5 flex flex-col gap-2">
                    <p>Selected Wallet: <span className="font-bold">{selectedWallet?.handle}.peanut.wallet</span></p>
                    <Button loading={isLoggingIn} disabled={isLoggingIn} onClick={() => {
                        if (!selectedWallet) return
                        const { handle } = selectedWallet
                        handleLogin(handle)
                    }}>Sign In</Button>
                </div>
            </Modal>
        </div>
    )
}

export default Layout
