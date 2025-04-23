'use client'

import { Button } from '@/components/0_Bruddle'
import { Icon } from '@/components/Global/Icons/Icon'
import { loadingStateContext } from '@/context'
import { useAuth } from '@/context/authContext'
import { getInitialsFromName } from '@/utils'
import { captureException } from '@sentry/nextjs'
import { useContext } from 'react'
import NavHeader from '../Global/NavHeader'
import ProfileHeader from './ProfileHeader'
import ProfileMenuItem from './ProfileMenuItem'

export const Profile = () => {
    const { setLoadingState, isLoading } = useContext(loadingStateContext)
    const { logoutUser, user } = useAuth()

    const handleLogout = async () => {
        try {
            setLoadingState('Logging out')
            await logoutUser()
        } catch (error) {
            console.error('Error logging out', error)
            captureException(error)
        } finally {
            setLoadingState('Idle')
        }
    }

    const fullName = user?.user.full_name || user?.user?.username || 'Anonymous User'
    const username = user?.user.username || 'anonymous'
    const initials = getInitialsFromName(fullName)

    return (
        <div className="h-full w-full bg-background">
            <NavHeader hideLabel />
            <div className="space-y-8">
                <ProfileHeader name={fullName} username={username} initials={initials} isVerified={true} />
                <div className="space-y-4">
                    {/* Menu Item - Invite Entry */}
                    <ProfileMenuItem icon="smile" label="Invite friends to Peanut" href="/invite" position="single" />
                    {/* Menu Items - First Group */}
                    <div>
                        <ProfileMenuItem
                            icon="user"
                            label="Personal details"
                            href="/profile/details"
                            position="first"
                        />
                        <ProfileMenuItem
                            icon="bank"
                            label="Bank accounts"
                            href="/profile/bank-accounts"
                            position="middle"
                        />
                        <ProfileMenuItem icon="achievements" label="Achievements" position="last" comingSoon={true} />
                    </div>
                    {/* Menu Items - Second Group */}
                    <div>
                        <ProfileMenuItem icon="fees" label="Fees" href="/profile/fees" position="first" />
                        <ProfileMenuItem icon="currency" label="Currency" position="middle" comingSoon={true} />
                        <ProfileMenuItem
                            icon="exchange"
                            label="Exchange rates"
                            href="/profile/exchange-rates"
                            position="last"
                        />
                    </div>
                    {/* Logout Button */}
                    <Button
                        disabled={isLoading}
                        variant="primary-soft"
                        shadowSize="4"
                        className="flex w-full items-center justify-center gap-2 rounded-sm py-3"
                        onClick={handleLogout}
                    >
                        <Icon name="logout" size={20} fill="black" />
                        <span className="font-bold">Log out</span>
                    </Button>
                </div>
            </div>
        </div>
    )
}
