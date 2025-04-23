import { Icon } from '@/components/Global/Icons/Icon'
import React, { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { Button } from '../0_Bruddle'
import Divider from '../0_Bruddle/Divider'

import BottomDrawer from '../Global/BottomDrawer'
import QRCodeWrapper from '../Global/QRCodeWrapper'
import ShareButton from '../Global/ShareButton'
import AvatarWithBadge from './AvatarWithBadge'

interface ProfileHeaderProps {
    name: string
    username: string
    initials: string
    isVerified?: boolean
    className?: string
}

const ProfileHeader: React.FC<ProfileHeaderProps> = ({ name, username, initials, isVerified = false, className }) => {
    const [isDrawerOpen, setIsDrawerOpen] = useState(false)

    const profileUrl = `peanut.me/${username}`

    return (
        <>
            <div className={twMerge('flex flex-col items-center space-y-2', className)}>
                {/* Avatar with initials */}
                <AvatarWithBadge initials={initials} isVerified={isVerified} />

                {/* Name */}
                <h1 className="mb-4 text-2xl font-bold">{name}</h1>

                {/* Username with share drawer */}
                <Button
                    size="small"
                    variant="primary-soft"
                    shadowSize="4"
                    className="flex w-fit items-center justify-center gap-2 rounded-full px-4 py-2"
                    onClick={() => {
                        navigator.clipboard.writeText(profileUrl)
                        setIsDrawerOpen(true)
                    }}
                >
                    <span className="font-semibold">peanut.me/{username}</span>
                    <Icon name="share" size={16} fill="black" />
                </Button>
            </div>
            {isDrawerOpen && (
                <>
                    <BottomDrawer
                        initialPosition="collapsed"
                        handleTitle={'Your Peanut profile is public'}
                        handleSubtitle="Share it to receive payments!"
                        collapsedHeight={80}
                        expandedHeight={90}
                        isOpen={isDrawerOpen}
                        onClose={() => setIsDrawerOpen(false)}
                    >
                        <div className="space-y-6">
                            <QRCodeWrapper url={profileUrl} />
                            <Divider className="text-gray-500" text="or" />
                            <ShareButton url={profileUrl} title="Share your profile">
                                Your Peanut profile is public
                            </ShareButton>
                        </div>
                    </BottomDrawer>
                </>
            )}
        </>
    )
}

export default ProfileHeader
