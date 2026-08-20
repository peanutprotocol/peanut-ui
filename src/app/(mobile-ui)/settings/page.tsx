'use client'

import { Button } from '@/components/0_Bruddle/Button'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { Icon } from '@/components/Global/Icons/Icon'
import NavHeader from '@/components/Global/NavHeader'
import { useAuth } from '@/context/authContext'
import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'

const SettingsPage = () => {
    const { logoutUser, isLoggingOut } = useAuth()
    const queryClient = useQueryClient()
    const router = useRouter()
    const tNav = useTranslations('navigation')
    const tSettings = useTranslations('settings')

    return (
        <div className="flex min-h-[inherit] flex-col justify-between gap-8">
            <NavHeader titleKey="settings" />
            <div className="flex flex-col">
                <ListItem
                    position="single"
                    leading={<IconBubble icon="globe" size="s" color="blue" />}
                    title={tSettings('language.title')}
                    chevron
                    onClick={() => router.push('/settings/language')}
                />
            </div>
            <Button
                loading={isLoggingOut}
                disabled={isLoggingOut}
                variant="primary-soft"
                shadowSize="4"
                className="flex w-full items-center justify-center gap-2 rounded-sm py-3"
                onClick={async () => {
                    await logoutUser()
                    queryClient.invalidateQueries()
                }}
            >
                <Icon name="logout" size={20} fill="black" />
                <span className="font-bold">{tNav('logout')}</span>
            </Button>
        </div>
    )
}

export default SettingsPage
