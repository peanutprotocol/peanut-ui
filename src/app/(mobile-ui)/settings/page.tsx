'use client'

import { Button } from '@/components/0_Bruddle/Button'
import { ListGroup } from '@/components/0_Bruddle/ListGroup'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { PageStack } from '@/components/0_Bruddle/PageStack'
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
        <PageStack>
            <NavHeader titleKey="settings" />
            <ListGroup>
                <ListItem
                    leading={<IconBubble icon="globe" size="s" color="blue" />}
                    title={tSettings('language.title')}
                    chevron
                    onClick={() => router.push('/settings/language')}
                />
            </ListGroup>
            <PageStack.Footer>
                <Button
                    loading={isLoggingOut}
                    disabled={isLoggingOut}
                    variant="primary-soft"
                    shadowSize="4"
                    className="w-full"
                    onClick={async () => {
                        await logoutUser()
                        queryClient.invalidateQueries()
                    }}
                >
                    <Icon name="logout" size={20} fill="black" />
                    <span className="font-bold">{tNav('logout')}</span>
                </Button>
            </PageStack.Footer>
        </PageStack>
    )
}

export default SettingsPage
