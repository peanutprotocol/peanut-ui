import { RecipientType } from '@/lib/url-parser/types/payment'
import { getInitialsFromName } from '@/utils'
import { useCallback, useMemo } from 'react'
import AddressLink from '../Global/AddressLink'
import Card from '../Global/Card'
import { Icon } from '../Global/Icons/Icon'
import AvatarWithBadge from '../Profile/AvatarWithBadge'

interface UserCardProps {
    type: 'send' | 'request' | 'payment'
    username: string
    fullName?: string
    recipientType?: RecipientType
}

const UserCard = ({ type, username, fullName, recipientType }: UserCardProps) => {
    const getTitle = useCallback(() => {
        if (type === 'send') return `You're sending money to`
        if (type === 'request') return `Requesting money from`
        if (type === 'payment') return `You're paying`
    }, [type])

    const initials = useMemo(() => {
        if (fullName) {
            return getInitialsFromName(fullName)
        }
        return getInitialsFromName(username)
    }, [username, fullName])

    return (
        <Card className="flex items-center gap-2 p-4">
            {recipientType !== 'USERNAME' ? (
                <div className={'flex size-8 items-center justify-center rounded-full bg-yellow-5 font-bold'}>
                    <Icon name="wallet-outline" size={16} />
                </div>
            ) : (
                <AvatarWithBadge initials={initials} size="extra-small" />
            )}
            <div>
                <div className="text-xs text-grey-1">{getTitle()}</div>
                {recipientType !== 'USERNAME' ? (
                    <AddressLink address={username} />
                ) : (
                    <div className="text-sm font-medium">{fullName || username}</div>
                )}
            </div>
        </Card>
    )
}

export default UserCard
