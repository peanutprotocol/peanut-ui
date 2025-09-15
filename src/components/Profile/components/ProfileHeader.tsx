import { Button } from '@/components/0_Bruddle'
import Divider from '@/components/0_Bruddle/Divider'
import { BASE_URL } from '@/components/Global/DirectSendQR/utils'
import { Icon } from '@/components/Global/Icons/Icon'
import QRCodeWrapper from '@/components/Global/QRCodeWrapper'
import ShareButton from '@/components/Global/ShareButton'
import React, { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import AvatarWithBadge from '../AvatarWithBadge'
import { Drawer, DrawerContent, DrawerTitle } from '@/components/Global/Drawer'
import { VerifiedUserLabel } from '@/components/UserHeader'
import { useAuth } from '@/context/authContext'
import useKycStatus from '@/hooks/useKycStatus'

interface ProfileHeaderProps {
    name: string
    username: string
    isVerified?: boolean
    className?: string
    showShareButton?: boolean
    haveSentMoneyToUser?: boolean
}

const ProfileHeader: React.FC<ProfileHeaderProps> = ({
    name,
    username,
    isVerified = false,
    className,
    showShareButton = true,
    haveSentMoneyToUser = false,
}) => {
    const { user: authenticatedUser } = useAuth()
    const { isUserKycApproved } = useKycStatus()
    const isAuthenticatedUserVerified = isUserKycApproved && authenticatedUser?.user.username === username
    const [isDrawerOpen, setIsDrawerOpen] = useState(false)

    const profileUrl = `${BASE_URL}/${username}`

    return (
        <>
            <div className={twMerge('flex flex-col items-center space-y-2', className)}>
                {/* Avatar with initials */}
                <AvatarWithBadge name={name || username} />

                {/* Name */}
                <VerifiedUserLabel
                    name={name}
                    isVerified={isVerified}
                    className="text-2xl font-bold"
                    iconSize={20}
                    haveSentMoneyToUser={haveSentMoneyToUser}
                    isAuthenticatedUserVerified={isAuthenticatedUserVerified}
                />
                {/* Username with share drawer */}
                {showShareButton && (
                    <Button
                        size="large"
                        variant="primary-soft"
                        shadowSize="4"
                        className="flex h-10 w-fit items-center justify-center rounded-full py-3 pl-6 pr-4"
                        onClick={() => {
                            navigator.clipboard.writeText(profileUrl)
                            setIsDrawerOpen(true)
                        }}
                    >
                        <div className="text-sm font-semibold">{profileUrl.replace('https://', '')}</div>
                        <div className="-ml-2">
                            <Icon name="share" size={16} fill="black" />
                        </div>
                    </Button>
                )}
            </div>
            {isDrawerOpen && (
                <>
                    <Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
                        <DrawerContent className="space-y-6 p-5">
                            <DrawerTitle className="mb-8 space-y-2">
                                <h2 className="text-lg font-bold">Your Peanut profile is public</h2>
                                <h2 className="text-base font-light">Share it to receive payments!</h2>
                            </DrawerTitle>

                            <QRCodeWrapper url={profileUrl} />
                            <Divider className="text-gray-500" text="or" />
                            <ShareButton url={profileUrl} title="Share your profile">
                                Share Profile link
                            </ShareButton>
                        </DrawerContent>
                    </Drawer>
                </>
            )}
        </>
    )
}

export default ProfileHeader
