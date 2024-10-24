'use client'

import { GlobalLoginComponent } from '@/components/Global/LoginComponent'
import '../../styles/globals.bruddle.css'
import { Card, NavIcons, NavIconsName } from '@/components/0_Bruddle'
import { useAuth } from '@/context/authContext'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import Loading from '@/components/Global/Loading'
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
        name: 'Settings',
        href: '/profile',
        icon: 'settings',
    },
]

const Layout = ({ children }: { children: React.ReactNode }) => {
    const [isReady, setIsReady] = useState(false)
    const { user, isFetchingUser } = useAuth()

    useEffect(() => {
        setIsReady(true)
    }, [])

    if (!isReady) return null

    if (isFetchingUser)
        return (
            <div className="flex h-screen w-full items-center justify-center">
                <Loading />
            </div>
        )

    if (!user)
        return (
            <div className="flex h-screen flex-col items-center justify-center p-2 sm:p-5 md:p-10">
                <Card shadowSize="6" className="w-full sm:w-2/3 lg:w-1/3">
                    <Card.Header>
                        <Card.Title>Sign In</Card.Title>
                        <Card.Description>Enter your account details to sign in</Card.Description>
                    </Card.Header>
                    <Card.Content>
                        <GlobalLoginComponent />
                    </Card.Content>
                </Card>
            </div>
        )

    return (
        <div className="flex h-screen flex-col">
            <HomeNav />
            <div className="flex w-full flex-1 overflow-y-scroll p-4">{children}</div>
            <div className="grid grid-cols-4 border-t-2 border-black p-2">
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
