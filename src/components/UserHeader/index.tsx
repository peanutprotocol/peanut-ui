import CopyToClipboard from '@/components/Global/CopyToClipboard'
import { BASE_URL } from '@/components/Global/DirectSendQR/utils'
import AvatarWithBadge from '@/components/Profile/AvatarWithBadge'
import Link from 'next/link'

interface UserHeaderProps {
    username: string
    fullName?: string
    isVerified?: boolean
}

export const UserHeader = ({ username, fullName, isVerified }: UserHeaderProps) => {
    return (
        <div className="flex items-center gap-1.5">
            <Link href={`/profile`} className="flex items-center gap-2">
                <AvatarWithBadge
                    size="extra-small"
                    className="w-7 h-7 text-[11px] md:w-8 md:h-8 md:text-[13px]"
                    isVerified={isVerified}
                    achievementsBadgeSize="extra-small"
                    name={fullName || username}
                />
                <div className="text-sm font-semibold md:text-base">{username}</div>
            </Link>
            <CopyToClipboard textToCopy={`${BASE_URL}/${username}`} fill="black" iconSize={'4'} />
        </div>
    )
}
