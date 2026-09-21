import { type IconName } from '@/components/Global/Icons/Icon'
import { IconBubble, type IconBubbleColor } from '@/components/0_Bruddle/IconBubble'
import { type StatusType } from '@/components/Global/Badges/Badge'
import AvatarWithBadge, { type AvatarSize } from '@/components/Profile/AvatarWithBadge'
import { UserAvatar } from '@/components/Avatar/UserAvatar'
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

/**
 * link rows (claim links and request links) show the LINK'S STATE, not a fixed
 * icon — the bubble IS the status. bank rows (flags) and person rows (avatars)
 * are out of scope and keep their own treatment. a status with no ruled bubble
 * falls back to the row's previous icon.
 */
export const LINK_STATE_BUBBLES: Partial<Record<StatusType, { icon: IconName; color: IconBubbleColor }>> = {
    pending: { icon: 'clock', color: 'gray' },
    processing: { icon: 'clock', color: 'gray' },
    completed: { icon: 'check', color: 'green' },
    cancelled: { icon: 'ban', color: 'gray' },
    refunded: { icon: 'ban', color: 'gray' },
    failed: { icon: 'alert', color: 'red' },
}

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
    /**
     * The counterparty's picked profile avatar (TASK-22625). Only read on the
     * person branch — a bank, link, wallet or card row keeps its icon whatever
     * this holds.
     */
    avatarKey?: string | null
    /**
     * The counterparty's handle, when the row has one. The letter sticker
     * follows it so a peer without a pick looks the same here as on their
     * profile, even though `userName` above honours their showFullName choice
     * (it also has to stay the display name — it is the address discriminator).
     * Falls back to `userName`.
     */
    avatarName?: string
    /**
     * The authoritative "there is a person behind this row" flag, when the
     * caller has one. `undefined` keeps this component's own heuristic (a named
     * row that is not an address). Pass `false` for a row whose name is system
     * copy — a reaper-failed transfer reads "Send didn't complete", which has
     * initials and is not an address, so nothing else here would catch it.
     */
    isPeer?: boolean
    /**
     * The row's transaction status. Read on link rows only, where it picks the
     * bubble (LINK_STATE_BUBBLES). Omit and those rows keep their fixed icon.
     */
    status?: StatusType
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
    avatarKey,
    avatarName,
    isPeer,
    status,
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

    const bubbleSize = ({ tiny: 'xs', 'extra-small': 's', small: 'm', medium: 'm', large: 'l' } as const)[size]

    // Claim links and request links are the link rows: every one of them shows
    // the link's own state. A request always qualifies — with a link it is a
    // request link, without one it is the counterparty-less request row.
    const isLinkRow =
        transactionType === 'request' ||
        ((transactionType === 'send' || transactionType === 'receive') && isLinkTransaction)
    const stateBubble = isLinkRow && status ? LINK_STATE_BUBBLES[status] : undefined
    if (stateBubble) {
        return <IconBubble icon={stateBubble.icon} size={bubbleSize} color={stateBubble.color} />
    }

    // An unfulfilled request has no counterparty — its display name is the
    // literal "Request", which used to render as an "RE" initials avatar and
    // read like a contact. Per designer QA it is an IconBubble with the
    // transaction-type icon (arrow-down-left, same as the row's action icon).
    // This is now the fallback for a row whose status has no ruled bubble; a
    // statused row took the state branch above.
    if (transactionType === 'request' && !isLinkTransaction) {
        return <IconBubble icon="arrow-down-left" size={bubbleSize} color="green" />
    }

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
            } else if (displayInitials && isPeer === false) {
                // Named, but nobody is behind it — the transformer rewrote the
                // name to system copy. Keep the initials circle: a sticker here
                // would draw a face for a failure message.
                const colors = getColorForUsername(userName)
                calculatedBgColor = colors.lightShade
                textColor = colors.darkShade
                displayIconName = undefined
            } else if (displayInitials) {
                // The one branch with a person behind it, so it shows who they
                // are: their picked avatar, or the letter sticker drawn from
                // the name this row already displays (TASK-22625). `decorative`
                // because that name is on screen right next to it.
                return <UserAvatar name={avatarName || userName} avatarKey={avatarKey} size={size} decorative />
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
