'use client'

import '../../styles/globals.bruddle.css'
import { NavIcons, NavIconsName } from '@/components/0_Bruddle'
import Link from 'next/link'
import { useEffect, useState } from 'react'

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
        name: 'Wallet',
        href: '/home',
        icon: 'wallet',
    },
    {
        name: 'History',
        href: '/history',
        icon: 'history',
    },
    {
        name: 'History',
        href: '/history',
        icon: 'settings',
    },
]

const Layout = ({ children }: { children: React.ReactNode }) => {
    const [isReady, setIsReady] = useState(false)

    useEffect(() => {
        setIsReady(true)
    }, [])

    if (!isReady) return null

    return (
        <div className="flex h-screen flex-col">
            <div className="flex w-full flex-1 overflow-y-scroll border bg-white">{children}</div>
            <div className="grid grid-cols-4 border-t-2 p-2">
                {tabs.map((tab) => (
                    <Link
                        href={tab.href}
                        key={tab.name}
                        className="flex flex-row justify-center py-2 hover:cursor-pointer hover:bg-gray-200 hover:text-purple-1"
                    >
                        <NavIcons name={tab.icon} size={30} />
                    </Link>
                ))}
            </div>
        </div>
    )
}

export default Layout
