import { type IconName } from '@/components/Global/Icons/Icon'
import AvatarWithBadge, { type AvatarSize } from '@/components/Profile/AvatarWithBadge'
import { type TransactionType } from '@/components/TransactionDetails/transaction-types'
import {
    AVATAR_LINK_BG,
    AVATAR_TEXT_DARK,
    AVATAR_TEXT_LIGHT,
    AVATAR_WALLET_BG,
    getColorForUsername,
} from '@/utils/color.utils'
import { getFlagUrl } from '@/constants/countryCurrencyMapping'
import React from 'react'
import { isAddress } from 'viem'

interface TransactionAvatarBadgeProps {
    size?: AvatarSize
    initials?: string
    userName?: string
    isLinkTransaction?: boolean
    transactionType: TransactionType
    context: 'card' | 'header' | 'drawer'
    /**
     * ISO-2 country code. When set + transactionType is a bank/cashout variant,
     * the badge renders the country flag instead of the generic bank icon.
     */
    countryCode?: string | null
}

/**
 * displays an appropriate avatar for a transaction entry.
 * handles showing initials, link icon, wallet icon, or bank icon based on context.
 */
const TransactionAvatarBadge: React.FC<TransactionAvatarBadgeProps> = ({
    initials,
    userName,
    isLinkTransaction = false,
    size = 'medium',
    transactionType,
    context,
    countryCode,
}) => {
    let displayIconName: IconName | undefined = undefined
    let displayInitials: string | undefined = initials
    let displayLogoUrl: string | undefined = undefined
    let calculatedBgColor = AVATAR_WALLET_BG
    let iconFillColor = AVATAR_TEXT_DARK
    let textColor = AVATAR_TEXT_DARK
    let logoFallback: { icon: IconName; bgColor?: string; iconFillColor?: string } | undefined = undefined

    // determine if the userName represents a user (not address or specific strings)
    const isValidUser = userName ? !isAddress(userName) : false

    // determine Icon, background, and colors based on type and context
    switch (transactionType) {
        case 'withdraw':
            displayIconName = 'wallet-outline'
            displayInitials = undefined
            break
        case 'bank_withdraw':
        case 'bank_deposit':
        case 'bank_request_fulfillment':
        case 'bank_claim':
        case 'cashout': {
            displayInitials = undefined
            // The dark badge bg is only used for list-item context on cashout;
            // everywhere else we render a dark circle regardless. Computed up
            // front so it's available as the flag-image fallback below.
            const useDarkBg = transactionType !== 'cashout' || context === 'card'
            const bankBg = useDarkBg ? AVATAR_TEXT_DARK : AVATAR_WALLET_BG
            const bankFg = useDarkBg ? AVATAR_TEXT_LIGHT : AVATAR_TEXT_DARK
            if (countryCode) {
                displayLogoUrl = getFlagUrl(countryCode)
                calculatedBgColor = AVATAR_WALLET_BG
                // If the flag asset 404s (obscure IBAN prefix that
                // circle-flags doesn't ship, or a mapping/asset drift like the
                // EUR → 'eu' case), swap to the same bank icon the
                // no-countryCode branch below renders. Same visual as prod.
                logoFallback = { icon: 'bank', bgColor: bankBg, iconFillColor: bankFg }
                break
            }
            // No country signal — fall back to the generic bank icon.
            displayIconName = 'bank'
            calculatedBgColor = bankBg
            textColor = bankFg
            iconFillColor = bankFg
            break
        }
        case 'add':
            displayIconName = 'wallet-outline'
            displayInitials = undefined
            // todo: revisit wen more deposit types are added
            // calculatedBgColor = context === 'card' ? AVATAR_TEXT_DARK : AVATAR_WALLET_BG
            // iconFillColor = context === 'card' ? AVATAR_TEXT_LIGHT : AVATAR_TEXT_DARK
            // textColor = context === 'card' ? AVATAR_TEXT_LIGHT : AVATAR_TEXT_DARK
            break
        case 'card_pay':
        case 'refund':
            // Rain card spend / card refund without a Rain-enriched merchant
            // logo (TransactionDetailsHeaderCard prefers `avatarUrl` when set,
            // so a real merchant brand mark wins over this fallback). A refund
            // shares the card-spend treatment — same merchant, same card.
            displayIconName = 'credit-card'
            displayInitials = undefined
            break
        case 'send':
        case 'request':
        case 'receive':
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
                calculatedBgColor = colors.lightShade
                textColor = colors.darkShade
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
            name={userName}
            icon={displayIconName}
            logo={displayLogoUrl}
            size={size}
            inlineStyle={{ backgroundColor: calculatedBgColor }}
            textColor={textColor}
            iconFillColor={iconFillColor}
            fallback={logoFallback}
        />
    )
}

export default TransactionAvatarBadge
