import { RecipientType } from '@/lib/url-parser/types/payment'
import { getColorForUsername } from '@/utils/color.utils'
import { useCallback } from 'react'
import AddressLink from '../Global/AddressLink'
import Card from '../Global/Card'
import AvatarWithBadge, { AvatarSize } from '../Profile/AvatarWithBadge'

interface UserCardProps {
    type: 'send' | 'request' | 'payment'
    username: string
    fullName?: string
    recipientType?: RecipientType
    size?: AvatarSize
}

const UserCard = ({ type, username, fullName, recipientType, size = 'extra-small' }: UserCardProps) => {
    const getTitle = useCallback(() => {
        if (type === 'send') return `You're sending money to`
        if (type === 'request') return `Requesting money from`
        if (type === 'payment') return `You're paying`
    }, [type])

    return (
        <Card className="flex items-center gap-3 p-4">
            <AvatarWithBadge
                icon={recipientType !== 'USERNAME' ? 'wallet-outline' : undefined}
                inlineStyle={{
                    backgroundColor:
                        recipientType !== 'USERNAME'
                            ? '#FFD700'
                            : getColorForUsername(fullName || username).backgroundColor,
                }}
                size={size}
                name={fullName || username}
            />
            <div>
                <div className="text-xs text-grey-1">{getTitle()}</div>
                {recipientType !== 'USERNAME' ? (
                    <AddressLink address={username} className="text-base font-medium" />
                ) : (
                    <div className="text-base font-medium">{fullName || username}</div>
                )}
            </div>
        </Card>
    )
}

export default UserCard
