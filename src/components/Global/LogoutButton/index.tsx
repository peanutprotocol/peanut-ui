import LOGOUT_ICON from '@/assets/icons/logout.svg'
import { Button } from '@/components/0_Bruddle/Button'
import { useAuth } from '@/context/authContext'
import { useTranslations } from 'next-intl'
import Image from '../Image'
import Loading from '../Loading'

const LogoutButton = () => {
    const t = useTranslations('navigation')
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
            {isLoggingOut ? <Loading /> : <Image src={LOGOUT_ICON} alt={t('logout')} width={24} height={24} />}
            <span className="hidden md:block">{isLoggingOut ? t('loggingOut') : t('logout')}</span>
        </Button>
    )
}

export default LogoutButton
