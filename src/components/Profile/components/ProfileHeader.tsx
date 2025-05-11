import { Button } from '@/components/0_Bruddle'
import Divider from '@/components/0_Bruddle/Divider'
import BottomDrawer from '@/components/Global/BottomDrawer'
import { BASE_URL } from '@/components/Global/DirectSendQR/utils'
import { Icon } from '@/components/Global/Icons/Icon'
import QRCodeWrapper from '@/components/Global/QRCodeWrapper'
import ShareButton from '@/components/Global/ShareButton'
import { useDynamicHeight } from '@/hooks/ui/useDynamicHeight'
import React, { useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import AvatarWithBadge from '../AvatarWithBadge'

interface ProfileHeaderProps {
    name: string
    username: string
    initials: string
    isVerified?: boolean
    className?: string
}

const ProfileHeader: React.FC<ProfileHeaderProps> = ({ name, username, initials, isVerified = false, className }) => {
    const [isDrawerOpen, setIsDrawerOpen] = useState(false)
    const contentRef = useRef<HTMLDivElement>(null)
    const drawerHeightVh = useDynamicHeight(contentRef, { maxHeightVh: 90, minHeightVh: 10, extraVhOffset: 5 })
    const currentExpandedHeight = drawerHeightVh ?? 60
    const currentHalfHeight = Math.min(60, drawerHeightVh ?? 60)

    const profileUrl = `${BASE_URL}/${username}`

    return (
        <>
            <div className={twMerge('flex flex-col items-center space-y-2', className)}>
                {/* Avatar with initials */}
                <AvatarWithBadge initials={initials} isVerified={isVerified} />

                {/* Name */}
                <h1 className="mb-4 text-2xl font-bold">{name}</h1>

                {/* Username with share drawer */}
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
            </div>
            {isDrawerOpen && (
                <>
                    <BottomDrawer
                        initialPosition="expanded"
                        handleTitle={'Your Peanut profile is public'}
                        handleSubtitle="Share it to receive payments!"
                        collapsedHeight={10}
                        expandedHeight={currentExpandedHeight}
                        halfHeight={currentHalfHeight}
                        isOpen={isDrawerOpen}
                        onClose={() => setIsDrawerOpen(false)}
                    >
                        <div className="space-y-6" ref={contentRef}>
                            <QRCodeWrapper url={profileUrl} />
                            <Divider className="text-gray-500" text="or" />
                            <ShareButton url={profileUrl} title="Share your profile">
                                Share Profile link
                            </ShareButton>
                        </div>
                    </BottomDrawer>
                </>
            )}
        </>
    )
}

export default ProfileHeader
