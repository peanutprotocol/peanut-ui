import { IconName } from '@/components/Global/Icons/Icon'
import AvatarWithBadge from '@/components/Profile/AvatarWithBadge'
import { getColorForUsername } from '@/utils/color.utils'
import React from 'react'
import { isAddress } from 'viem'

type PeerAvatarSize = 'extra-small' | 'small' | 'medium' | 'large'

interface TransactionAvatarBadgeProps {
    initials?: string
    userName?: string
    isLinkTransaction?: boolean
    isVerified?: boolean
    size?: PeerAvatarSize
}

/**
 * displays an appropriate avatar for a transaction entry.
 * handles showing initials with a hashed background color for known users,
 * a link icon for link-based transactions, or a wallet icon for addresses/non-users.
 */
const TransactionAvatarBadge: React.FC<TransactionAvatarBadgeProps> = ({
    initials,
    userName,
    isLinkTransaction = false,
    isVerified = false,
    size = 'medium',
}) => {
    let displayIconName: IconName | undefined = undefined
    let displayInitials: string | undefined = initials
    let calculatedBgColor = '#FF90E8' // default for link icon

    // determine icon/initials and background color based on transaction type/peer type
    if (isLinkTransaction) {
        displayIconName = 'link'
        displayInitials = undefined // never show initials for pure links
        calculatedBgColor = '#FF90E8' // peanut purple for links
    } else if (userName && isAddress(userName)) {
        // if the username is an evm address, show wallet icon
        displayIconName = 'wallet-outline'
        displayInitials = undefined
        calculatedBgColor = '#FFC900' // yellow for ens/addresses
    } else if (displayInitials) {
        // if we have initials
        // calculate a background color based on their username
        const { backgroundColor } = getColorForUsername(userName)
        calculatedBgColor = backgroundColor
    } else {
        // fallback case if no initials, not a link, and not an address (should be rare)
        displayIconName = 'wallet-outline' // default to wallet icon
        calculatedBgColor = '#FFC900' // default to yellow
    }

    return (
        <AvatarWithBadge
            isVerified={isVerified}
            initials={displayInitials}
            icon={displayIconName}
            size={size}
            achievementsBadgeSize={size === 'medium' || size === 'large' ? 'small' : 'extra-small'}
            inlineStyle={{ backgroundColor: calculatedBgColor }}
        />
    )
}

export default TransactionAvatarBadge
