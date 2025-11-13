import { Button } from '@/components/0_Bruddle'
import { BASE_URL } from '@/components/Global/DirectSendQR/utils'
import { Icon } from '@/components/Global/Icons/Icon'
import React, { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import AvatarWithBadge from '../AvatarWithBadge'
import { VerifiedUserLabel } from '@/components/UserHeader'
import { useAuth } from '@/context/authContext'
import useKycStatus from '@/hooks/useKycStatus'
import CopyToClipboard from '@/components/Global/CopyToClipboard'

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
    const isSelfProfile = authenticatedUser?.user.username?.toLowerCase() === username.toLowerCase()

    const profileUrl = `${BASE_URL}/${username}`

    return (
        <>
            <div className={twMerge('flex flex-col items-center space-y-2', className)}>
                {/* Avatar with initials */}
                <AvatarWithBadge name={name || username} />

                {/* Name */}
                <div className="flex items-center gap-1.5">
                    <VerifiedUserLabel
                        name={name}
                        username={username}
                        isVerified={isVerified}
                        className="text-2xl font-bold"
                        iconSize={20}
                        haveSentMoneyToUser={haveSentMoneyToUser}
                        isAuthenticatedUserVerified={isAuthenticatedUserVerified && isSelfProfile} // can be true only for self profile
                    />
                    <CopyToClipboard textToCopy={username} fill="black" iconSize="4" />
                </div>
                {/* Username with share drawer */}
                {showShareButton && (
                    <Button
                        size="large"
                        variant="primary-soft"
                        shadowSize="4"
                        className="flex h-10 w-fit items-center justify-center rounded-full py-3 pl-6 pr-4"
                        onClick={() => {
                            // navigator.clipboard.writeText(profileUrl)
                            navigator.share({
                                url: profileUrl,
                            })
                        }}
                    >
                        <div className="text-sm font-semibold">{profileUrl.replace('https://', '')}</div>
                        <div className="-ml-2">
                            <Icon name="share" size={16} fill="black" />
                        </div>
                    </Button>
                )}
            </div>
        </>
    )
}

export default ProfileHeader
