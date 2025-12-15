'use client'

import { Button } from '@/components/0_Bruddle/Button'
import { Icon } from '@/components/Global/Icons/Icon'
import { useAuth } from '@/context/authContext'
import NavHeader from '../Global/NavHeader'
import ProfileHeader from './components/ProfileHeader'
import ProfileMenuItem from './components/ProfileMenuItem'
import { useRouter } from 'next/navigation'
import { checkIfInternalNavigation, generateInviteCodeLink, generateInvitesShareText } from '@/utils/general.utils'
import ActionModal from '../Global/ActionModal'
import { useState } from 'react'
import useKycStatus from '@/hooks/useKycStatus'
import Card from '../Global/Card'
import ShowNameToggle from './components/ShowNameToggle'
import ShareButton from '../Global/ShareButton'
import CopyToClipboard from '../Global/CopyToClipboard'
import KycVerifiedOrReviewModal from '../Global/KycVerifiedOrReviewModal'
import { STAR_STRAIGHT_ICON } from '@/assets'
import Image from 'next/image'
import QRCode from 'react-qr-code'

export const Profile = () => {
    const { logoutUser, isLoggingOut, user } = useAuth()
    const [isKycApprovedModalOpen, setIsKycApprovedModalOpen] = useState(false)
    const [isInviteFriendsModalOpen, setIsInviteFriendsModalOpen] = useState(false)
    const [showInitiateKycModal, setShowInitiateKycModal] = useState(false)
    const router = useRouter()
    const { isUserKycApproved } = useKycStatus()

    const logout = async () => {
        await logoutUser()
    }

    const fullName = user?.user.fullName || user?.user?.username || 'Anonymous User'
    const username = user?.user.username || 'anonymous'
    // respect user's showFullName preference: use fullName only if showFullName is true, otherwise use username
    const displayName = user?.user.showFullName && user?.user.fullName ? user.user.fullName : username

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
                <ProfileHeader name={displayName} username={username} isVerified={isUserKycApproved} />
                <div className="space-y-4">
                    <ProfileMenuItem
                        icon="smile"
                        label="Invite friends to Peanut"
                        onClick={() => setIsInviteFriendsModalOpen(true)}
                        href="/dummy" // Dummy link, wont be called
                        position="single"
                    />
                    {/* Menu Items - First Group */}
                    <div>
                        <ProfileMenuItem icon="achievements" label="Your Badges" href="/badges" position="first" />
                        <ProfileMenuItem
                            icon={<Image src={STAR_STRAIGHT_ICON} alt="star" width={20} height={20} />}
                            label="Points"
                            href="/points"
                            position="last"
                        />
                    </div>
                    <div>
                        <ProfileMenuItem icon="user" label="Personal details" href="/profile/edit" position="first" />
                        <ProfileMenuItem
                            icon="globe-lock"
                            label="Regions & Verification"
                            href="/profile/identity-verification"
                            onClick={() => {
                                setShowInitiateKycModal(true)
                            }}
                            position="middle"
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
                    </div>
                    {/* Menu Items - Second Group */}
                    <ProfileMenuItem
                        icon="exchange"
                        label="Exchange rates and fees"
                        href="/profile/exchange-rate"
                        position="single"
                    />
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
                        {inviteData.inviteLink && (
                            <div className="my-2 size-44">
                                <QRCode
                                    value={inviteData.inviteLink}
                                    size={120}
                                    style={{ height: 'auto', maxWidth: '100%', width: '100%' }}
                                    viewBox={`0 0 120 120`}
                                    level="H" // Highest error correction level to allow for logo
                                />
                            </div>
                        )}
                        <div className="flex w-full items-center justify-between gap-3">
                            <Card className="flex items-center justify-between py-2">
                                <p className="overflow-hidden text-ellipsis whitespace-nowrap text-sm font-bold ">{`${inviteData.inviteCode}`}</p>

                                <CopyToClipboard textToCopy={`${inviteData.inviteCode}`} iconSize="4" />
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
