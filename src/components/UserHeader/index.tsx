import CopyToClipboard from '@/components/Global/CopyToClipboard'
import { BASE_URL } from '@/components/Global/DirectSendQR/utils'
import AvatarWithBadge from '@/components/Profile/AvatarWithBadge'
import { getInitialsFromName } from '@/utils'
import Link from 'next/link'
import { useMemo } from 'react'

interface UserHeaderProps {
    username: string
    fullName?: string
    isVerified?: boolean
}

export const UserHeader = ({ username, fullName, isVerified }: UserHeaderProps) => {
    const initals = useMemo(() => {
        if (fullName) {
            return getInitialsFromName(fullName)
        }

        return getInitialsFromName(username)
    }, [username, fullName])

    return (
        <div className="flex items-center gap-1.5">
            <Link href={`/profile`} className="flex items-center gap-1.5">
                <AvatarWithBadge
                    size="extra-small"
                    initials={initals}
                    isVerified={isVerified}
                    achievementsBadgeSize="extra-small"
                />
                <div className="text-sm font-bold">{`${BASE_URL.replace('https://', '')}/${username}`}</div>
            </Link>
            <CopyToClipboard textToCopy={`${BASE_URL}/${username}`} fill="black" iconSize={'4'} />
        </div>
    )
}
