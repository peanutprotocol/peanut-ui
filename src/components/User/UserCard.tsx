import { getInitialsFromName } from '@/utils'
import { useMemo } from 'react'
import Card from '../Global/Card'
import AvatarWithBadge from '../Profile/AvatarWithBadge'

interface UserCardProps {
    type: 'send' | 'request'
    username: string
    fullName?: string
}

const UserCard = ({ type, username, fullName }: UserCardProps) => {
    const initials = useMemo(() => {
        if (fullName) {
            return getInitialsFromName(fullName)
        }
        return getInitialsFromName(username)
    }, [username, fullName])

    return (
        <Card className="flex items-center gap-2 p-4">
            <AvatarWithBadge initials={initials} size="extra-small" />
            <div>
                <div className="text-xs text-grey-1">{type === 'send' ? 'Sending to' : 'Requesting from'}</div>
                <div className="text-sm font-medium">{fullName || username}</div>
            </div>
        </Card>
    )
}

export default UserCard
