import { LOGOUT_ICON } from '@/assets'
import { Button } from '@/components/0_Bruddle'
import { useAuth } from '@/context/authContext'
import Image from '../Image'
import Loading from '../Loading'

const LogoutButton = () => {
    const { logoutUser, isLoggingOut, user } = useAuth()

    const logout = async () => {
        await logoutUser()
    }
    if (!user) {
        return null
    }

    return (
        <Button
            disabled={isLoggingOut}
            size="medium"
            variant="transparent"
            onClick={logout}
            className="flex w-fit items-center gap-3 px-0 hover:text-gray-1 md:px-3"
        >
            {isLoggingOut ? <Loading /> : <Image src={LOGOUT_ICON} alt="Logout" width={24} height={24} />}
            <span className="hidden md:block">{isLoggingOut ? 'Logging out...' : 'Logout'}</span>
        </Button>
    )
}

export default LogoutButton
