'use client'
import { LOGOUT_ICON } from '@/assets'
import { Button } from '@/components/0_Bruddle'
import { useAuth } from '@/context/authContext'
import { getHeaderTitle } from '@/utils'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import Loading from '../Loading'

const TopNavbar = () => {
    const { logoutUser, isLoggingOut } = useAuth()
    const pathname = usePathname()

    const logout = async () => {
        await logoutUser()
    }

    return (
        <div className="hidden h-[72px] items-center justify-between border-b border-b-black bg-background px-6 md:flex">
            <h1 className="text-2xl font-extrabold md:ml-64">{getHeaderTitle(pathname)}</h1>
            <Button
                disabled={isLoggingOut}
                size="medium"
                variant="transparent-dark"
                onClick={logout}
                className="flex w-fit items-center gap-3 hover:text-gray-1"
            >
                {isLoggingOut ? <Loading /> : <Image src={LOGOUT_ICON} alt="Logout" width={24} height={24} />}
                {isLoggingOut ? 'Logging out...' : 'Logout'}
            </Button>
        </div>
    )
}

export default TopNavbar
