'use client'

import { Button } from '@/components/0_Bruddle'
import { Icon } from '@/components/Global/Icons/Icon'
import { useAuth } from '@/context/authContext'
import NavHeader from '../Global/NavHeader'
import ProfileHeader from './components/ProfileHeader'
import ProfileMenuItem from './components/ProfileMenuItem'
import { useRouter } from 'next/navigation'
import { checkIfInternalNavigation } from '@/utils'
import ActionModal from '../Global/ActionModal'
import { useState } from 'react'

export const Profile = () => {
    const { logoutUser, isLoggingOut, user } = useAuth()
    const [isKycApprovedModalOpen, setIsKycApprovedModalOpen] = useState(false)
    const router = useRouter()

    const logout = async () => {
        await logoutUser()
    }

    const fullName = user?.user.fullName || user?.user?.username || 'Anonymous User'
    const username = user?.user.username || 'anonymous'

    const isKycApproved = user?.user.bridgeKycStatus === 'approved'

    return (
        <div className="h-full w-full bg-background">
            <NavHeader
                hideLabel
                onPrev={() => {
                    // Check if the referrer is from the same domain (internal navigation)
                    const isInternalReferrer = checkIfInternalNavigation()

                    if (isInternalReferrer && window.history.length > 1) {
                        router.back()
                    } else {
                        router.push('/home')
                    }
                }}
            />
            <div className="space-y-8">
                <ProfileHeader name={fullName || username} username={username} isVerified={isKycApproved} />
                <div className="space-y-4">
                    {/* Menu Item - Invite Entry */}
                    {/* Enable with Invites project. */}
                    {/* <ProfileMenuItem
                        icon="smile"
                        label="Invite friends to Peanut"
                        href="https://docs.peanut.me/how-to-use-peanut-links/referrals"
                        position="single"
                        isExternalLink
                    /> */}
                    {/* Menu Items - First Group */}
                    <div>
                        <ProfileMenuItem icon="user" label="Personal details" href="/profile/edit" position="first" />
                        <ProfileMenuItem
                            icon="shield"
                            label="Identity Verification"
                            href="/profile/identity-verification"
                            onClick={() => {
                                if (isKycApproved) {
                                    setIsKycApprovedModalOpen(true)
                                } else {
                                    router.push('/profile/identity-verification')
                                }
                            }}
                            position="middle"
                            endIcon={isKycApproved ? 'check' : undefined}
                            endIconClassName={isKycApproved ? 'text-success-3 size-4' : undefined}
                        />
                        {/* Enable with Account Management project. */}
                        {/* <ProfileMenuItem
                            icon="bank"
                            label="Bank accounts"
                            href="/profile/bank-accounts"
                            position="middle"
                            comingSoon
                        /> */}
                        <ProfileMenuItem icon="achievements" label="Achievements" position="last" comingSoon />
                    </div>
                    {/* Menu Items - Second Group */}
                    <div>
                        <ProfileMenuItem icon="currency" label="Currency" position="first" comingSoon />
                        <ProfileMenuItem
                            icon="exchange"
                            label="Exchange rates and fees"
                            href="/profile/exchange-rate"
                            position="last"
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

            <ActionModal
                visible={isKycApprovedModalOpen}
                onClose={() => setIsKycApprovedModalOpen(false)}
                title="You’re already verified"
                description="Your identity has already been successfully verified. No further action is needed."
                icon="shield"
                ctas={[
                    {
                        text: 'Go back',
                        shadowSize: '4',
                        className: 'md:py-2',
                        onClick: () => setIsKycApprovedModalOpen(false),
                    },
                ]}
            />
        </div>
    )
}
