'use client'
import { getHeaderTitle } from '@/utils'
import { usePathname } from 'next/navigation'
import LogoutButton from '../LogoutButton'

const TopNavbar = () => {
    const pathname = usePathname()

    return (
        <div className="hidden h-[72px] items-center justify-between border-b border-b-black bg-background px-6 md:flex">
            <h1 className="text-2xl font-extrabold md:ml-64">{getHeaderTitle(pathname)}</h1>
            <LogoutButton />
        </div>
    )
}

export default TopNavbar
