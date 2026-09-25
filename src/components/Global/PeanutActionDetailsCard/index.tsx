import AvatarWithBadge, { type AvatarSize } from '@/components/Profile/AvatarWithBadge'
import { UserAvatar } from '@/components/Avatar/UserAvatar'
import { avatarSrc, letterAvatarSrc } from '@/components/Avatar/avatar.utils'
import { type RecipientType } from '@/lib/url-parser/types/payment'
import { printableAddress } from '@/utils/general.utils'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { CONCEPT_ICONS } from '@/components/0_Bruddle/conceptIcons'
import { AVATAR_TEXT_DARK, getColorForUsername } from '@/utils/color.utils'
import { useTranslations } from 'next-intl'
import { useCallback } from 'react'
import { twMerge } from '@/utils/tw'
import Attachment from '../Attachment'
import { Card } from '@/components/0_Bruddle/Card'
import { Icon, type IconName } from '../Icons/Icon'
import { type StaticImageData } from 'next/image'
import { getFlagUrl } from '@/constants/countryCurrencyMapping'
import Loading from '../Loading'
import { PEANUT_WALLET_TOKEN_SYMBOL } from '@/constants/zerodev.consts'

export type PeanutActionDetailsCardTransactionType =
    | 'REQUEST'
    | 'RECEIVED_LINK'
    | 'CLAIM_LINK'
    | 'CLAIM_LINK_BANK_ACCOUNT'
    | 'REQUEST_PAYMENT'
    | 'ADD_MONEY'
    | 'WITHDRAW'
    | 'WITHDRAW_BANK_ACCOUNT'
    | 'ADD_MONEY_BANK_ACCOUNT'
    | 'REGIONAL_METHOD_CLAIM'

export type PeanutActionDetailsCardRecipientType = RecipientType | 'BANK_ACCOUNT'

export interface PeanutActionDetailsCardProps {
    transactionType: PeanutActionDetailsCardTransactionType
    recipientType: PeanutActionDetailsCardRecipientType
    recipientName: string
    message?: string
    amount: string
    tokenSymbol: string
    viewType?: 'NORMAL' | 'SUCCESS'
    className?: HTMLDivElement['className']
    fileUrl?: string
    avatarSize?: AvatarSize
    countryCodeForFlag?: string
    currencySymbol?: string
    isLoading?: boolean
    logo?: StaticImageData
    /** The other person's picked avatar (TASK-22625). Read only on the branch
     *  that would otherwise draw their initials — every icon branch ignores it. */
    avatarKey?: string | null
    /**
     * A withdraw the user reached through the send flow (Send → Exchange or
     * Wallet / Bank). Mechanically identical to a withdraw — only the verb
     * differs, so this branches the title and nothing else.
     *
     * Without it this card can only ever be right for one of its two callers,
     * which is why the copy has already been flipped in opposite directions
     * twice (abd71b882 → "sending", d532b6a65 → "withdrawing").
     */
    isFromSendFlow?: boolean
}

export default function PeanutActionDetailsCard({
    transactionType,
    recipientType,
    recipientName,
    message,
    amount,
    tokenSymbol,
    viewType = 'NORMAL',
    className,
    fileUrl,
    avatarSize = 'l',
    countryCodeForFlag,
    currencySymbol,
    isLoading = false,
    logo,
    avatarKey,
    isFromSendFlow = false,
}: PeanutActionDetailsCardProps) {
    const t = useTranslations('global')
    const renderRecipient = () => {
        if (recipientType === 'ADDRESS') return printableAddress(recipientName)

        return recipientName
    }

    const getIcon = (): IconName | undefined => {
        if (transactionType === 'REQUEST_PAYMENT') return 'arrow-up-right'
        if (transactionType === 'ADD_MONEY' || transactionType === 'CLAIM_LINK_BANK_ACCOUNT') return 'arrow-down'
        if (transactionType === 'REQUEST' || transactionType === 'RECEIVED_LINK') return 'arrow-down-left'
        if (transactionType === 'CLAIM_LINK') return viewType !== 'SUCCESS' ? 'arrow-down' : undefined
        if (
            transactionType === 'WITHDRAW' ||
            transactionType === 'WITHDRAW_BANK_ACCOUNT' ||
            transactionType === 'REGIONAL_METHOD_CLAIM'
        )
            return 'arrow-up'
        return undefined
    }

    const getTitle = () => {
        let title = ''
        let icon = getIcon()
        if (transactionType === 'REQUEST_PAYMENT')
            title = t('peanutActionDetailsCard.sendingTo', { recipient: renderRecipient() })
        if (transactionType === 'REQUEST') title = t('peanutActionDetailsCard.youRequested')
        if (transactionType === 'RECEIVED_LINK')
            title = t('peanutActionDetailsCard.sentYou', { sender: renderRecipient() })
        if (transactionType === 'CLAIM_LINK') {
            if (viewType === 'SUCCESS') title = t('peanutActionDetailsCard.youJustClaimed')
            else title = t('peanutActionDetailsCard.sentYou', { sender: renderRecipient() })
        }
        if (transactionType === 'ADD_MONEY' || transactionType === 'ADD_MONEY_BANK_ACCOUNT')
            title = t('peanutActionDetailsCard.youreAdding')
        if (transactionType === 'WITHDRAW' || transactionType === 'WITHDRAW_BANK_ACCOUNT')
            title = isFromSendFlow
                ? t('peanutActionDetailsCard.youreSending')
                : t('peanutActionDetailsCard.youreWithdrawing')
        if (transactionType === 'CLAIM_LINK_BANK_ACCOUNT') {
            if (viewType === 'SUCCESS') {
                title = t('peanutActionDetailsCard.youWillReceive')
            } else {
                title = t('peanutActionDetailsCard.youreAboutToReceive')
            }
        }
        if (transactionType === 'REGIONAL_METHOD_CLAIM') title = recipientName // Render the string as is for regional method
        return (
            <h1 className="flex items-center gap-2 overflow-hidden text-body-m text-ellipsis whitespace-nowrap text-foreground-secondary">
                {icon && <Icon name={icon} size={16} />} {title}
            </h1>
        )
    }

    const getAvatarIcon = useCallback((): IconName | undefined => {
        if (viewType === 'SUCCESS') return 'check'
        if (
            transactionType === 'WITHDRAW_BANK_ACCOUNT' ||
            transactionType === 'ADD_MONEY_BANK_ACCOUNT' ||
            transactionType === 'CLAIM_LINK_BANK_ACCOUNT'
        )
            return 'bank'
        // an external address or wallet is the crypto concept
        if (recipientType !== 'USERNAME' || transactionType === 'ADD_MONEY' || transactionType === 'WITHDRAW')
            return CONCEPT_ICONS.crypto.icon
        return undefined
    }, [viewType, transactionType, recipientType])

    const getAvatarBackgroundColor = (): string => {
        if (viewType === 'SUCCESS') return 'var(--color-background-icon-bubble-green)'
        if (
            transactionType === 'ADD_MONEY' ||
            (transactionType === 'WITHDRAW' && recipientType === 'USERNAME') ||
            recipientType === 'ADDRESS' ||
            recipientType === 'ENS' ||
            transactionType === 'WITHDRAW_BANK_ACCOUNT' ||
            transactionType === 'CLAIM_LINK_BANK_ACCOUNT'
        )
            return 'var(--color-background-icon-bubble-blue)'
        return getColorForUsername(recipientName).lightShade
    }

    const getAvatarTextColor = (): string => {
        if (
            viewType === 'SUCCESS' ||
            transactionType === 'ADD_MONEY' ||
            (transactionType === 'WITHDRAW' && recipientType === 'USERNAME') ||
            recipientType === 'ADDRESS' ||
            recipientType === 'ENS' ||
            transactionType === 'WITHDRAW_BANK_ACCOUNT' ||
            transactionType === 'CLAIM_LINK_BANK_ACCOUNT'
        ) {
            return AVATAR_TEXT_DARK
        }
        return getColorForUsername(recipientName).darkShade
    }

    // No icon means the avatar slot stood for a person — the only case where an
    // avatar belongs. A caller-supplied brand logo still wins.
    //
    // The art check is load-bearing: the claim views and CountryListRouter
    // hardcode recipientType="USERNAME" while passing a resolved display name,
    // which is a shortened address whenever the counterparty has no Peanut
    // account. Those draw neither a pick nor a letter, so they keep the
    // initials bubble they had.
    const avatarIcon = getAvatarIcon()
    const showsPersonAvatar = !avatarIcon && !logo && !!(avatarSrc(avatarKey) ?? letterAvatarSrc(recipientName))

    const isWithdrawBankAccount = transactionType === 'WITHDRAW_BANK_ACCOUNT' && recipientType === 'BANK_ACCOUNT'
    const isAddBankAccount = transactionType === 'ADD_MONEY_BANK_ACCOUNT'
    const isClaimLinkBankAccount = transactionType === 'CLAIM_LINK_BANK_ACCOUNT' && recipientType === 'BANK_ACCOUNT'
    const isRegionalMethodClaim = transactionType === 'REGIONAL_METHOD_CLAIM'

    /*
     * one leading element, per the ListItem-leading rule: the flag or the
     * provider logo, with the bank icon as its fallback when neither loads.
     * same shape as TransactionAvatarBadge's bank rows. the mini bank bubble
     * this used to overlay on the flag is gone — a composite leading has no
     * board row (design.md open conflicts, "listitem leading composite").
     */
    const bankAvatar = () => {
        if (!(isWithdrawBankAccount || isAddBankAccount || isClaimLinkBankAccount || isRegionalMethodClaim))
            return undefined
        const imgSrc = logo ?? (countryCodeForFlag ? getFlagUrl(countryCodeForFlag) : undefined)
        const bankBubble = <IconBubble {...CONCEPT_ICONS.bank} size="m" />
        return imgSrc ? <AvatarWithBadge size="m" logo={imgSrc} fallback={bankBubble} /> : bankBubble
    }

    return (
        <Card className={twMerge('p-4', className)}>
            <div className="flex items-center gap-3">
                <div className="flex items-center gap-3">
                    {viewType !== 'SUCCESS' &&
                    (isWithdrawBankAccount || isAddBankAccount || isClaimLinkBankAccount || isRegionalMethodClaim) ? (
                        bankAvatar()
                    ) : showsPersonAvatar ? (
                        // The branch that used to draw the counterparty's
                        // initials: a Peanut handle with no icon of its own.
                        // `decorative` because the card names them above.
                        <UserAvatar name={recipientName} avatarKey={avatarKey} size={avatarSize} decorative />
                    ) : (
                        <AvatarWithBadge
                            icon={avatarIcon}
                            size={avatarSize}
                            name={viewType === 'NORMAL' ? recipientName : undefined}
                            inlineStyle={{
                                backgroundColor: getAvatarBackgroundColor(),
                                color: getAvatarTextColor(),
                            }}
                            logo={logo}
                        />
                    )}
                </div>

                <div className="flex w-full flex-col gap-1">
                    {getTitle()}
                    {isLoading ? (
                        <Loading />
                    ) : (
                        <h2 className="text-heading-s">
                            {(transactionType === 'ADD_MONEY' || isAddBankAccount || isClaimLinkBankAccount) &&
                            currencySymbol
                                ? `${currencySymbol}`
                                : tokenSymbol.toLowerCase() === PEANUT_WALLET_TOKEN_SYMBOL.toLowerCase() ||
                                    (transactionType === 'CLAIM_LINK_BANK_ACCOUNT' && viewType === 'SUCCESS')
                                  ? '$'
                                  : ''}
                            {amount}

                            {tokenSymbol.toLowerCase() !== PEANUT_WALLET_TOKEN_SYMBOL.toLowerCase() &&
                                transactionType !== 'ADD_MONEY' &&
                                !isClaimLinkBankAccount &&
                                !(transactionType === 'CLAIM_LINK_BANK_ACCOUNT' && viewType === 'SUCCESS') &&
                                ` ${tokenSymbol}`}
                        </h2>
                    )}

                    <Attachment message={message ?? ''} fileUrl={fileUrl ?? ''} />
                </div>
            </div>
        </Card>
    )
}
