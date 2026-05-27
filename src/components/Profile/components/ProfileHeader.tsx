import { Button } from '@/components/0_Bruddle/Button'
import { BASE_URL } from '@/components/Global/DirectSendQR/utils'
import { Icon } from '@/components/Global/Icons/Icon'
import React, { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import AvatarWithBadge from '../AvatarWithBadge'
import { VerifiedUserLabel } from '@/components/UserHeader'
import { useAuth } from '@/context/authContext'
import { useCapabilities } from '@/hooks/useCapabilities'
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
    // MIGRATION-REVIEW: old `isUserKycApproved` = any provider approved (bridge OR manteca OR sumsub).
    // New `isKycApproved` = any rail enabled. These differ at the edges: a Sumsub-only approved user
    // (no enabled payment rail yet) would have shown the self-profile verified badge before but not now;
    // conversely the set is otherwise equivalent. The caller already gates this on self-profile, and the
    // badge here is cosmetic — kept as the closest 1:1. Note the task suggested hasEnabledRail('bridge')/
    // ('manteca'), but this file only ever read the any-provider flag, so isKycApproved is the faithful swap.
    const { isKycApproved } = useCapabilities()
    const isAuthenticatedUserVerified = isKycApproved && authenticatedUser?.user.username === username
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
                    <CopyToClipboard textToCopy={username} fill="black" iconSize="5" />
                </div>
                {/* Username with share drawer */}
                {showShareButton && (
                    <Button
                        size="large"
                        variant="primary-soft"
                        shadowSize="4"
                        className="flex h-10 w-fit items-center justify-center rounded-full py-3 pl-6 pr-4"
                        onClick={() => {
                            if (navigator.share) {
                                navigator
                                    .share({
                                        url: profileUrl,
                                    })
                                    .catch((error) => {
                                        console.error('Error sharing:', error)
                                    })
                            } else {
                                navigator.clipboard.writeText(profileUrl)
                            }
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
