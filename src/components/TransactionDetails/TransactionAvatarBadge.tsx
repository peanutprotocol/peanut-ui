import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { conceptBubbleFor, type Concept } from '@/components/0_Bruddle/conceptIcons'
import { type StatusType } from '@/components/Global/Badges/Badge'
import AvatarWithBadge, { type AvatarSize } from '@/components/Profile/AvatarWithBadge'
import { UserAvatar } from '@/components/Avatar/UserAvatar'
import { type TransactionType } from '@/components/TransactionDetails/transaction-types'
import { AVATAR_TEXT_DARK, AVATAR_WALLET_BG, getColorForUsername } from '@/utils/color.utils'
import { getFlagUrl } from '@/constants/countryCurrencyMapping'
import React from 'react'
import { isAddress } from 'viem'

/**
 * every concept bubble on an activity row (the list and the receipt head both
 * render through here) is icon = concept, color = state: the concept's own
 * color once done, yellow while pending, red when failed, gray when cancelled
 * or refunded (STATE_BUBBLE_COLORS, TASK-22761). flags, merchant logos and
 * person avatars keep their own image and carry no state color.
 */
interface TransactionAvatarBadgeProps {
    size?: AvatarSize
    initials?: string
    userName?: string
    isLinkTransaction?: boolean
    transactionType: TransactionType
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
     * The row's transaction status. Colors every concept bubble
     * (STATE_BUBBLE_COLORS); flags and avatars ignore it.
     */
    status?: StatusType
}

/**
 * displays an appropriate avatar for a transaction entry.
 * handles showing initials, a user avatar, a flag, or a concept bubble.
 */
const TransactionAvatarBadge: React.FC<TransactionAvatarBadgeProps> = ({
    initials,
    userName,
    isLinkTransaction = false,
    size = 'l',
    transactionType,
    countryCode,
    avatarKey,
    avatarName,
    isPeer,
    status,
}) => {
    let displayInitials: string | undefined = initials
    let displayLogoUrl: string | undefined = undefined
    let calculatedBgColor = AVATAR_WALLET_BG
    let textColor = AVATAR_TEXT_DARK
    let logoFallback: React.ReactNode = undefined

    // determine if the userName represents a user (not address or specific strings)
    const isValidUser = userName ? !isAddress(userName) : false

    const bubbleSize = ({ xs: 'xs', s: 's', m: 'm', l: 'm', xl: 'l' } as const)[size]

    // a row that shows a product concept rather than a person or a flag takes
    // that concept's icon, the same one the Send, Add and Withdraw lists use,
    // colored by the row's state
    const conceptBubble = (concept: Concept) => <IconBubble {...conceptBubbleFor(concept, status)} size={bubbleSize} />

    // An unfulfilled request has no counterparty — its display name is the
    // literal "Request", which used to render as an "RE" initials avatar and
    // read like a contact. It is the request link concept; with no status it
    // is still waiting to be paid, so it reads as pending.
    if (transactionType === 'request' && !isLinkTransaction) {
        return <IconBubble {...conceptBubbleFor('requestLink', status ?? 'pending')} size={bubbleSize} />
    }

    // determine Icon, background, and colors based on type
    switch (transactionType) {
        case 'withdraw':
        case 'add':
        case 'claim_external':
            return conceptBubble('crypto')
        case 'pay':
            return conceptBubble('qrPay')
        case 'bank_withdraw':
        case 'bank_deposit':
        case 'bank_request_fulfillment':
        case 'bank_claim':
        case 'cashout': {
            if (!countryCode) return conceptBubble('bank')
            displayInitials = undefined
            displayLogoUrl = getFlagUrl(countryCode)
            calculatedBgColor = AVATAR_WALLET_BG
            // If the flag asset 404s (obscure IBAN prefix that circle-flags
            // doesn't ship, or a mapping/asset drift like the EUR → 'eu'
            // case), swap to the bank concept's bubble.
            logoFallback = conceptBubble('bank')
            break
        }
        case 'card_pay':
        case 'refund':
            // Rain card spend / card refund without a Rain-enriched merchant
            // logo (TransactionDetailsHeaderCard prefers `avatarUrl` when set,
            // so a real merchant brand mark wins over this fallback). A refund
            // shares the card-spend treatment — same merchant, same card.
            return conceptBubble('card')
        case 'send':
        case 'request':
        case 'receive':
            if (isLinkTransaction) {
                return conceptBubble(transactionType === 'request' ? 'requestLink' : 'sendLink')
            } else if (!isValidUser) {
                // an address, not a person: a crypto send or receive
                return conceptBubble('crypto')
            } else if (displayInitials && isPeer === false) {
                // Named, but nobody is behind it — the transformer rewrote the
                // name to system copy. Keep the initials circle: a sticker here
                // would draw a face for a failure message.
                const colors = getColorForUsername(userName)
                calculatedBgColor = colors.lightShade
                textColor = colors.darkShade
                break
            } else if (displayInitials) {
                // The one branch with a person behind it, so it shows who they
                // are: their picked avatar, or the letter sticker drawn from
                // the name this row already displays (TASK-22625). `decorative`
                // because that name is on screen right next to it.
                return <UserAvatar name={avatarName || userName} avatarKey={avatarKey} size={size} decorative />
            }
            // no name and not a link: an external wallet, the crypto concept
            return conceptBubble('crypto')
        default:
            return conceptBubble('crypto')
    }

    return (
        <AvatarWithBadge
            name={userName}
            logo={displayLogoUrl}
            size={size}
            inlineStyle={{ backgroundColor: calculatedBgColor }}
            textColor={textColor}
            fallback={logoFallback}
        />
    )
}

export default TransactionAvatarBadge
