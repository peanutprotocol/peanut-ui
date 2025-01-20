import { PeanutGuy } from '@/assets'
import { Badge } from '@/components/0_Bruddle/Badge'
import CopyToClipboard from '@/components/Global/CopyToClipboard'
import { useAuth } from '@/context/authContext'
import Image from 'next/image'

interface ProfileSectionProps {}

const ProfileSection = ({}: ProfileSectionProps) => {
    const { user } = useAuth()

    const points = {
        Points: user?.points,
        Invites: user?.totalReferralPoints,
        // todo: implement boost logic
        Boost: 0,
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <Image
                        src={PeanutGuy}
                        alt="profile image"
                        className="size-11 rounded-full border border-black object-contain"
                    />
                    <div className="text-md space-y-1 font-semibold">
                        <div className="text-grey-1">peanut.me/</div>
                        <div className="flex items-center gap-3">
                            <div className="">{user?.user.username}</div>
                            {user?.user.kycStatus !== null && (
                                <Badge color="purple" className="text-primary-1 bg-white">
                                    No KYC
                                </Badge>
                            )}
                        </div>
                    </div>
                </div>
                <div className="flex size-8 items-center justify-center rounded-full bg-white p-2">
                    <CopyToClipboard fill="black" textToCopy={`https://peanut.me/${user?.user.username}`} />
                </div>
            </div>
            <div className="border-t border-dashed border-black">
                {
                    <div className="flex justify-between py-2">
                        {Object.entries(points).map(([key, value]) => (
                            <div key={key} className="space-y-0.5">
                                <div className="text-base font-bold">{value}</div>
                                <div className="text-xs text-gray-500">{key}</div>
                            </div>
                        ))}
                    </div>
                }
            </div>
        </div>
    )
}

export default ProfileSection
