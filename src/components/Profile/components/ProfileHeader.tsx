import { Icon } from '@/components/Global/Icons/Icon'
import React, { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { Button } from '../../0_Bruddle'
import AchievementsBadge from '../../Global/Badges/AchievementsBadge'
import QRBottomDrawer from '../../Global/QRBottomDrawer'

interface ProfileHeaderProps {
    name: string
    username: string
    initials: string
    isVerified?: boolean
    className?: string
}

const ProfileHeader: React.FC<ProfileHeaderProps> = ({ name, username, initials, isVerified = false, className }) => {
    const [isQRScannerOpen, setIsQRScannerOpen] = useState(false)

    const profileUrl = `peanut.me/${username}`

    return (
        <>
            <div className={twMerge('flex flex-col items-center space-y-2', className)}>
                {/* Avatar with initials */}
                <div className="relative ">
                    <div
                        className={twMerge(
                            'flex h-16 w-16 items-center justify-center rounded-full bg-yellow-5 text-2xl font-bold'
                        )}
                    >
                        {initials}
                    </div>

                    {isVerified && <AchievementsBadge />}
                </div>

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
                        setIsQRScannerOpen(true)
                    }}
                >
                    <span className="font-semibold">peanut.me/{username}</span>
                    <Icon name="share" size={16} fill="black" />
                </Button>
            </div>
            {isQRScannerOpen && (
                <>
                    <QRBottomDrawer
                        url={profileUrl}
                        collapsedTitle="Your Peanut profile is public"
                        expandedTitle="Your Peanut profile is public"
                        text="Let others scan this to see your profile"
                        buttonText="Share Profile Link"
                    />
                </>
            )}
        </>
    )
}

export default ProfileHeader
