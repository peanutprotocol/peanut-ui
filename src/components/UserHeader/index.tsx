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
            <Link href={`/profile`} className="flex items-center gap-1.5">
                <AvatarWithBadge
                    size="extra-small"
                    isVerified={isVerified}
                    achievementsBadgeSize="extra-small"
                    name={fullName || username}
                />
                <div className="text-sm font-bold">{`${BASE_URL.replace('https://', '')}/${username}`}</div>
            </Link>
            <CopyToClipboard textToCopy={`${BASE_URL}/${username}`} fill="black" iconSize={'4'} />
        </div>
    )
}
