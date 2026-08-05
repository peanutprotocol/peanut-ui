'use client'
import { useTranslations } from 'next-intl'
import { usePathname } from 'next/navigation'
import LogoutButton from '../LogoutButton'

const PATH_TITLE_KEYS = {
    '/home': 'dashboard',
    '/send': 'send',
    '/request/create': 'request',
    '/request/pay': 'pay',
    '/cashout': 'cashout',
    '/history': 'history',
    '/support': 'support',
    '/claim': 'claim',
} as const

const TopNavbar = () => {
    const t = useTranslations('navigation')
    const pathname = usePathname()
    const titleKey = PATH_TITLE_KEYS[pathname as keyof typeof PATH_TITLE_KEYS]

    return (
        <div className="hidden h-[72px] items-center justify-between border-b border-b-black bg-background px-6 md:flex">
            <h1 className="text-2xl font-extrabold md:ml-64">{titleKey ? t(titleKey) : 'Peanut'}</h1>
            <LogoutButton />
        </div>
    )
}

export default TopNavbar
