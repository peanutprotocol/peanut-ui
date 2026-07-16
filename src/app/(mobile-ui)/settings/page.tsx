'use client'

import { Button } from '@/components/0_Bruddle/Button'
import { useAuth } from '@/context/authContext'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'

const SettingsPage = () => {
    const { logoutUser } = useAuth()
    const queryClient = useQueryClient()
    const t = useTranslations('navigation')

    return (
        <div className="flex min-h-screen w-full flex-col justify-center p-2 sm:p-5 md:p-10">
            <Button
                onClick={() => {
                    logoutUser()
                    queryClient.invalidateQueries()
                }}
            >
                {t('logout')}
            </Button>
        </div>
    )
}

export default SettingsPage
