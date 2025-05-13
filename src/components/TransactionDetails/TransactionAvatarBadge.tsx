import { IconName } from '@/components/Global/Icons/Icon'
import AvatarWithBadge from '@/components/Profile/AvatarWithBadge'
import { TransactionType } from '@/components/TransactionDetails/TransactionCard'
import {
    AVATAR_LINK_BG,
    AVATAR_TEXT_DARK,
    AVATAR_TEXT_LIGHT,
    AVATAR_WALLET_BG,
    getColorForUsername,
} from '@/utils/color.utils'
import React from 'react'
import { isAddress } from 'viem'

type PeerAvatarSize = 'extra-small' | 'small' | 'medium' | 'large'

interface TransactionAvatarBadgeProps {
    initials?: string
    userName?: string
    isLinkTransaction?: boolean
    isVerified?: boolean
    size?: PeerAvatarSize
    transactionType: TransactionType
    context: 'card' | 'header'
}

/**
 * displays an appropriate avatar for a transaction entry.
 * handles showing initials, link icon, wallet icon, or bank icon based on context.
 */
const TransactionAvatarBadge: React.FC<TransactionAvatarBadgeProps> = ({
    initials,
    userName,
    isLinkTransaction = false,
    isVerified = false,
    size = 'medium',
    transactionType,
    context,
}) => {
    let displayIconName: IconName | undefined = undefined
    let displayInitials: string | undefined = initials
    let calculatedBgColor = AVATAR_WALLET_BG
    let iconFillColor = AVATAR_TEXT_DARK
    let textColor = AVATAR_TEXT_DARK

    // determine if the userName represents a user (not address or specific strings)
    const isValidUser = userName ? !isAddress(userName) : false

    // determine Icon, background, and colors based on type and context
    switch (transactionType) {
        case 'withdraw':
        case 'cashout':
            displayIconName = 'bank'
            displayInitials = undefined
            calculatedBgColor = context === 'card' ? AVATAR_TEXT_DARK : AVATAR_WALLET_BG
            textColor = context === 'card' ? AVATAR_TEXT_LIGHT : AVATAR_TEXT_DARK
            break
        case 'add':
            displayIconName = 'wallet-outline'
            displayInitials = undefined
            calculatedBgColor = context === 'card' ? AVATAR_TEXT_DARK : AVATAR_WALLET_BG
            iconFillColor = context === 'card' ? AVATAR_TEXT_LIGHT : AVATAR_TEXT_DARK
            textColor = context === 'card' ? AVATAR_TEXT_LIGHT : AVATAR_TEXT_DARK
            break
        case 'send':
        case 'request':
            if (isLinkTransaction) {
                displayIconName = 'link'
                displayInitials = undefined
                calculatedBgColor = AVATAR_LINK_BG
                iconFillColor = AVATAR_TEXT_DARK
            } else if (!isValidUser) {
                displayIconName = 'wallet-outline'
                displayInitials = undefined
                calculatedBgColor = AVATAR_WALLET_BG
                iconFillColor = AVATAR_TEXT_DARK
            } else if (displayInitials) {
                const colors = getColorForUsername(userName)
                calculatedBgColor = colors.backgroundColor
                textColor = AVATAR_TEXT_DARK
                displayIconName = undefined
            } else {
                // fallback for send/request if no initials and not link/address
                displayIconName = 'wallet-outline'
                calculatedBgColor = AVATAR_WALLET_BG
                iconFillColor = AVATAR_TEXT_DARK
            }
            break
        default:
            displayIconName = 'wallet-outline'
            calculatedBgColor = AVATAR_WALLET_BG
            iconFillColor = AVATAR_TEXT_DARK
            break
    }

    return (
        <AvatarWithBadge
            isVerified={isVerified && !!displayInitials}
            name={userName}
            icon={displayIconName}
            size={size}
            achievementsBadgeSize={size === 'medium' || size === 'large' ? 'small' : 'extra-small'}
            inlineStyle={{ backgroundColor: calculatedBgColor }}
            textColor={textColor}
            iconFillColor={iconFillColor}
        />
    )
}

export default TransactionAvatarBadge
