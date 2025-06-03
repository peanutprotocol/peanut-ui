import { RecipientType } from '@/lib/url-parser/types/payment'
import { AVATAR_TEXT_DARK, getColorForUsername } from '@/utils/color.utils'
import { useCallback } from 'react'
import AddressLink from '../Global/AddressLink'
import Attachment from '../Global/Attachment'
import Card from '../Global/Card'
import { Icon, IconName } from '../Global/Icons/Icon'
import AvatarWithBadge, { AvatarSize } from '../Profile/AvatarWithBadge'

interface UserCardProps {
    type: 'send' | 'request' | 'received_link'
    username: string
    fullName?: string
    recipientType?: RecipientType
    size?: AvatarSize
    message?: string
    fileUrl?: string
}

const UserCard = ({
    type,
    username,
    fullName,
    recipientType,
    size = 'extra-small',
    message,
    fileUrl,
}: UserCardProps) => {
    const getIcon = (): IconName | undefined => {
        if (type === 'send') return 'arrow-up-right'
        if (type === 'request') return 'arrow-down-left'
        if (type === 'received_link') return 'arrow-down-left'
    }

    const getTitle = useCallback(() => {
        const icon = getIcon()
        let title = ''
        if (type === 'send') title = `You're sending money to`
        if (type === 'request') title = `Requesting money from`
        if (type === 'received_link') title = `You received`

        return (
            <div className="flex items-center gap-2 text-xs font-normal text-grey-1">
                {icon && <Icon name={icon} size={8} />} {title}
            </div>
        )
    }, [type])

    return (
        <Card className="flex items-center gap-2 p-4">
            <AvatarWithBadge
                icon={recipientType !== 'USERNAME' ? 'wallet-outline' : undefined}
                inlineStyle={{
                    backgroundColor:
                        recipientType !== 'USERNAME' ? '#FFD700' : getColorForUsername(fullName || username).lightShade,
                    color:
                        recipientType !== 'USERNAME'
                            ? AVATAR_TEXT_DARK
                            : getColorForUsername(fullName || username).darkShade,
                }}
                size={size}
                name={fullName || username}
            />
            <div>
                {getTitle()}
                {recipientType !== 'USERNAME' ? (
                    <AddressLink address={username} className="text-base font-medium" />
                ) : (
                    <div className="text-base font-medium">{fullName || username}</div>
                )}
                <Attachment message={message ?? ''} fileUrl={fileUrl ?? ''} />
            </div>
        </Card>
    )
}

export default UserCard
