'use client'

import { Button } from '@/components/0_Bruddle/Button'
import { Icon } from '@/components/Global/Icons/Icon'
import { useAuth } from '@/context/authContext'
import NavHeader from '../Global/NavHeader'
import ProfileHeader from './components/ProfileHeader'
import ProfileMenuItem from './components/ProfileMenuItem'
import { useRouter } from 'next/navigation'
import { useState, useMemo } from 'react'
import { useCapabilities } from '@/hooks/useCapabilities'
import { useSafeBack } from '@/hooks/useSafeBack'
import { useCardPioneerInfo } from '@/hooks/useCardPioneerInfo'
import underMaintenanceConfig from '@/config/underMaintenance.config'
import Card from '../Global/Card'
import ShowNameToggle from './components/ShowNameToggle'
import KycVerifiedOrReviewModal from '../Global/KycVerifiedOrReviewModal'
import InviteFriendsModal from '../Global/InviteFriendsModal'
import { STAR_STRAIGHT_ICON } from '@/assets'
import Image from 'next/image'

export const Profile = () => {
    const { logoutUser, isLoggingOut, user } = useAuth()
    const [isKycApprovedModalOpen, setIsKycApprovedModalOpen] = useState(false)
    const [isInviteFriendsModalOpen, setIsInviteFriendsModalOpen] = useState(false)
    const router = useRouter()
    const onBack = useSafeBack('/home')
    // MIGRATION-REVIEW: ⚠️ NOT a clean 1:1 — old value was `isUserSumsubKycApproved` (Sumsub ID cleared),
    // NOT `isUserKycApproved`. The pre-existing comment below is explicit: the verified badge + the
    // "Regions & Verification" highlight mean the *human* was ID-verified, which only Sumsub clears —
    // an enabled Bridge/Manteca rail alone must NOT flip them. But the capability model has no Sumsub
    // rail (ProviderCode = bridge|manteca|rain), so there is no direct signal. `isKycApproved` (any
    // enabled rail) is the closest available proxy but is BROADER: a pool-Manteca-only user would now
    // read as verified here. Flagging for Hugo — may need a dedicated `identity-verified` capability
    // signal rather than reusing isKycApproved. (Task said isUserKycApproved→isKycApproved, but the
    // actual field read was the Sumsub-specific one.)
    // Profile "verified" reflects identity verification only. Bridge/Manteca
    // approval just means a payment rail is enabled, not that the human has
    // been ID-verified — only Sumsub clears that bar.
    const { isKycApproved: isUserSumsubKycApproved } = useCapabilities()
    const { hasCardAccess } = useCardPioneerInfo()

    const logout = async () => {
        await logoutUser()
    }

    const username = user?.user.username || 'anonymous'
    // respect user's showFullName preference: use fullName only if showFullName is true, otherwise use username
    const displayName = user?.user.showFullName && user?.user.fullName ? user.user.fullName : username
    const showCard = useMemo(() => !underMaintenanceConfig.disableCardPioneers || hasCardAccess, [hasCardAccess])

    return (
        <div className="h-full w-full bg-background">
            <NavHeader hideLabel showLogoutBtn onPrev={onBack} />
            <div className="space-y-8">
                <ProfileHeader name={displayName} username={username} isVerified={isUserSumsubKycApproved} />
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
                        {showCard && (
                            <ProfileMenuItem icon="credit-card" label="Your Card" href="/card" position="first" />
                        )}
                        <ProfileMenuItem
                            icon="achievements"
                            label="Your Badges"
                            href="/badges"
                            position={showCard ? 'middle' : 'first'}
                        />
                        <ProfileMenuItem
                            icon={<Image src={STAR_STRAIGHT_ICON} alt="star" width={20} height={20} />}
                            label="Points"
                            href="/rewards"
                            position="last"
                        />
                    </div>
                    <div>
                        <ProfileMenuItem icon="user" label="Personal details" href="/profile/edit" position="first" />

                        <ProfileMenuItem
                            icon="globe-lock"
                            label="Regions & Verification"
                            href="/profile/identity-verification"
                            position="middle"
                            highlight={!isUserSumsubKycApproved}
                        />

                        <ProfileMenuItem icon="meter" label="Payment limits" href="/limits" position="middle" />

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
                        <ProfileMenuItem
                            icon="upload-cloud"
                            label="Backup"
                            href="/profile/backup"
                            onClick={() => router.push('/profile/backup')}
                            position="last"
                        />
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

            <InviteFriendsModal
                visible={isInviteFriendsModalOpen}
                onClose={() => setIsInviteFriendsModalOpen(false)}
                username={user?.user.username ?? ''}
                source="profile"
            />
        </div>
    )
}
