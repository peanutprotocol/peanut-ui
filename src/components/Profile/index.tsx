'use client'

import { Button } from '@/components/0_Bruddle'
import { Icon } from '@/components/Global/Icons/Icon'
import { useAuth } from '@/context/authContext'
import NavHeader from '../Global/NavHeader'
import ProfileHeader from './components/ProfileHeader'
import ProfileMenuItem from './components/ProfileMenuItem'
import { useRouter } from 'next/navigation'
import { checkIfInternalNavigation, generateInviteCodeLink, generateInvitesShareText } from '@/utils'
import ActionModal from '../Global/ActionModal'
import { useState } from 'react'
import useKycStatus from '@/hooks/useKycStatus'
import Card from '../Global/Card'
import ShowNameToggle from './components/ShowNameToggle'
import ShareButton from '../Global/ShareButton'
import CopyToClipboard from '../Global/CopyToClipboard'
import KycVerifiedOrReviewModal from '../Global/KycVerifiedOrReviewModal'

export const Profile = () => {
    const { logoutUser, isLoggingOut, user } = useAuth()
    const [isKycApprovedModalOpen, setIsKycApprovedModalOpen] = useState(false)
    const [isInviteFriendsModalOpen, setIsInviteFriendsModalOpen] = useState(false)
    const [showInitiateKycModal, setShowInitiateKycModal] = useState(false)
    const router = useRouter()
    const { isUserKycApproved, isUserBridgeKycUnderReview } = useKycStatus()

    const logout = async () => {
        await logoutUser()
    }

    const fullName = user?.user.fullName || user?.user?.username || 'Anonymous User'
    const username = user?.user.username || 'anonymous'

    const inviteData = generateInviteCodeLink(user?.user.username ?? '')

    return (
        <div className="h-full w-full bg-background">
            <NavHeader
                hideLabel
                showLogoutBtn
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
                <ProfileHeader name={fullName || username} username={username} isVerified={isUserKycApproved} />
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
                    <ProfileMenuItem
                        icon="smile"
                        label="Invite friends to Peanut"
                        onClick={() => setIsInviteFriendsModalOpen(true)}
                        href="/dummy" // Dummy link, wont be called
                        position="single"
                    />
                    {/* Menu Items - First Group */}
                    <div>
                        <ProfileMenuItem icon="user" label="Personal details" href="/profile/edit" position="first" />
                        <ProfileMenuItem
                            icon="shield"
                            label="Identity Verification"
                            href="/profile/identity-verification"
                            onClick={() => {
                                setShowInitiateKycModal(true)
                            }}
                            position="middle"
                            endIcon={isUserKycApproved ? 'check' : undefined}
                            endIconClassName={isUserKycApproved ? 'text-success-3 size-4' : undefined}
                        />

                        <Card className="p-4" position="middle">
                            <div className="flex items-center justify-between py-1">
                                <div className="flex items-center gap-2">
                                    <Icon name={'eye'} size={20} fill="black" />
                                    <span className="text-base font-medium">Show my full name</span>
                                </div>

                                <div className="flex items-center">
                                    <ShowNameToggle />
                                </div>
                            </div>
                        </Card>
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
                            loading={isLoggingOut}
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

            <KycVerifiedOrReviewModal
                isKycApprovedModalOpen={isKycApprovedModalOpen}
                onClose={() => setIsKycApprovedModalOpen(false)}
            />

            <ActionModal
                visible={isInviteFriendsModalOpen}
                onClose={() => setIsInviteFriendsModalOpen(false)}
                title="Invite friends!"
                description="Earn points when your referrals create an account in Peanut and also pocket 20% of the points they make!"
                icon="user-plus"
                content={
                    <>
                        <div className="flex w-full items-center justify-between gap-3">
                            <Card className="flex items-center justify-between py-2">
                                <p className="overflow-hidden text-ellipsis whitespace-nowrap text-sm font-bold ">{`${inviteData.inviteCode}`}</p>

                                <CopyToClipboard textToCopy={`${inviteData.inviteCode}`} />
                            </Card>
                        </div>
                        <ShareButton
                            generateText={() => Promise.resolve(generateInvitesShareText(inviteData.inviteLink))}
                            title="Share your invite link"
                        >
                            Share Invite link
                        </ShareButton>
                    </>
                }
            />

            <ActionModal
                visible={showInitiateKycModal}
                onClose={() => setShowInitiateKycModal(false)}
                title="Verification, Only If You Need It"
                description="No need to verify unless you want to move money to or from your bank."
                icon="shield"
                ctaClassName="flex-col sm:flex-col"
                ctas={[
                    {
                        text: 'Verify now',
                        shadowSize: '4',
                        className: 'md:py-2',
                        onClick: () => router.push('/profile/identity-verification'),
                    },
                    {
                        variant: 'transparent-dark',
                        className:
                            'text-black underline text-xs font-medium h-2 mt-1 hover:text-black active:text-black',
                        text: 'Not now',
                        onClick: () => setShowInitiateKycModal(false),
                    },
                ]}
            />
        </div>
    )
}
