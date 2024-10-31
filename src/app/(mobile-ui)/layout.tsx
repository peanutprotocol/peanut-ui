'use client'

import '../../styles/globals.bruddle.css'
import { NavIcons, NavIconsName } from '@/components/0_Bruddle'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import HomeNav from '@/components/Home/HomeNav'

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
    const [isReady, setIsReady] = useState(false)

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
