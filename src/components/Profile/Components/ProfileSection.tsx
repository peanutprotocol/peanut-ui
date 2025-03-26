import { PEANUTMAN_PFP } from '@/assets'
import { Badge } from '@/components/0_Bruddle/Badge'
import CopyToClipboard from '@/components/Global/CopyToClipboard'
import { useAuth } from '@/context/authContext'
import Image from 'next/image'
import { memo, useCallback, useMemo } from 'react'

const ProfileSection = memo(() => {
    const { user } = useAuth()

    const points = useMemo(
        () => ({
            Points: user?.points,
            Invites: user?.totalReferralPoints,
            Boost: 0,
        }),
        [user?.points, user?.totalReferralPoints]
    )

    const handleCopy = useCallback(() => {
        return `https://peanut.me/${user?.user.username}`
    }, [user?.user.username])

    return (
        <div className="space-y-4 py-2">
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="flex size-12 items-center justify-center rounded-full border border-black bg-white pb-0.5 pt-1">
                        <Image
                            src={PEANUTMAN_PFP}
                            alt="profile image"
                            className="size-11 rounded-full object-contain"
                        />
                    </div>
                    <div className="text-md space-y-1 font-semibold">
                        <div className="notranslate text-grey-1" translate="no">
                            peanut.me/
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="">{user?.user.username}</div>
                            {user?.user.kycStatus === 'approved' && (
                                <Badge color="green" className="rounded-sm border-success-1 bg-white text-success-1">
                                    KYC Done
                                </Badge>
                            )}
                        </div>
                    </div>
                </div>
                <div className="flex size-8 items-center justify-center rounded-full bg-white p-2">
                    <CopyToClipboard fill="black" textToCopy={handleCopy()} />
                </div>
            </div>
        </div>
    )
})

ProfileSection.displayName = 'ProfileSection'

export default ProfileSection
