'use client'

import { Button } from '@/components/0_Bruddle'
import { Icon } from '@/components/Global/Icons/Icon'
import { useAuth } from '@/context/authContext'
import NavHeader from '../Global/NavHeader'
import ProfileHeader from './components/ProfileHeader'
import ProfileMenuItem from './components/ProfileMenuItem'

export const Profile = () => {
    const { logoutUser, isLoggingOut, user } = useAuth()

    const logout = async () => {
        await logoutUser()
    }

    const fullName = user?.user.full_name || user?.user?.username || 'Anonymous User'
    const username = user?.user.username || 'anonymous'

    return (
        <div className="h-full w-full bg-background">
            <NavHeader hideLabel />
            <div className="space-y-8">
                <ProfileHeader
                    name={fullName || username}
                    username={username}
                    isVerified={user?.user.kycStatus === 'approved'}
                />
                <div className="space-y-4">
                    {/* Menu Item - Invite Entry */}
                    <ProfileMenuItem
                        icon="smile"
                        label="Invite friends to Peanut"
                        href="https://docs.peanut.to/how-to-use-peanut-links/referrals"
                        position="single"
                        isExternalLink
                    />
                    {/* Menu Items - First Group */}
                    <div>
                        <ProfileMenuItem icon="user" label="Personal details" href="/profile/edit" position="first" />
                        <ProfileMenuItem
                            icon="bank"
                            label="Bank accounts"
                            href="/profile/bank-accounts"
                            position="middle"
                            comingSoon
                        />
                        <ProfileMenuItem icon="achievements" label="Achievements" position="last" comingSoon />
                    </div>
                    {/* Menu Items - Second Group */}
                    <div>
                        <ProfileMenuItem
                            icon="fees"
                            label="Fees"
                            href="https://docs.peanut.to/fees"
                            position="first"
                            isExternalLink
                        />
                        <ProfileMenuItem icon="currency" label="Currency" position="middle" comingSoon />
                        <ProfileMenuItem
                            icon="exchange"
                            label="Exchange rates"
                            href="/profile/exchange-rates"
                            position="last"
                            comingSoon
                        />
                    </div>
                    {/* Logout Button */}
                    <div className="w-full pb-10">
                        <Button
                            disabled={isLoggingOut}
                            variant="primary-soft"
                            shadowSize="4"
                            className="flex w-full items-center justify-center gap-2 rounded-sm py-3"
                            onClick={logout}
                        >
                            <Icon name="logout" size={20} fill="black" />
                            <span className="font-bold">Log out</span>
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}
