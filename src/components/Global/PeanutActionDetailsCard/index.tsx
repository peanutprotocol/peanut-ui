import AvatarWithBadge, { AvatarSize } from '@/components/Profile/AvatarWithBadge'
import { PEANUT_WALLET_TOKEN_SYMBOL } from '@/constants'
import { RecipientType } from '@/lib/url-parser/types/payment'
import { printableAddress } from '@/utils'
import { AVATAR_TEXT_DARK, getColorForUsername } from '@/utils/color.utils'
import { useCallback } from 'react'
import { twMerge } from 'tailwind-merge'
import Attachment from '../Attachment'
import Card from '../Card'
import { Icon, IconName } from '../Icons/Icon'
import Image from 'next/image'

interface PeanutActionDetailsCardProps {
    transactionType:
        | 'REQUEST'
        | 'RECEIVED_LINK'
        | 'CLAIM_LINK'
        | 'REQUEST_PAYMENT'
        | 'ADD_MONEY'
        | 'WITHDRAW'
        | 'WITHDRAW_BANK_ACCOUNT'
    recipientType: RecipientType | 'BANK_ACCOUNT'
    recipientName: string
    message?: string
    amount: string
    tokenSymbol: string
    viewType?: 'NORMAL' | 'SUCCESS'
    className?: HTMLDivElement['className']
    fileUrl?: string
    avatarSize?: AvatarSize
    countryCodeForFlag?: string
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
    avatarSize = 'medium',
    countryCodeForFlag,
}: PeanutActionDetailsCardProps) {
    const renderRecipient = () => {
        if (recipientType === 'ADDRESS') return printableAddress(recipientName)

        return recipientName
    }

    const getIcon = (): IconName | undefined => {
        if (transactionType === 'REQUEST_PAYMENT') return 'arrow-up-right'
        if (transactionType === 'ADD_MONEY') return 'arrow-down'
        if (transactionType === 'REQUEST' || transactionType === 'RECEIVED_LINK') return 'arrow-down-left'
        if (transactionType === 'CLAIM_LINK') return viewType !== 'SUCCESS' ? 'arrow-down' : undefined
        if (transactionType === 'WITHDRAW' || transactionType === 'WITHDRAW_BANK_ACCOUNT') return 'arrow-up'
    }

    const getTitle = () => {
        let title = ''
        let icon = getIcon()
        if (transactionType === 'REQUEST_PAYMENT') title = `You're sending ${renderRecipient()}`
        if (transactionType === 'REQUEST') title = `You requested`
        if (transactionType === 'RECEIVED_LINK') title = `${renderRecipient()} sent you`
        if (transactionType === 'CLAIM_LINK') {
            if (viewType === 'SUCCESS') title = `You just claimed`
            else title = `${renderRecipient()} sent you`
        }
        if (transactionType === 'ADD_MONEY') title = `You're adding`
        if (transactionType === 'WITHDRAW' || transactionType === 'WITHDRAW_BANK_ACCOUNT') title = `You're withdrawing`
        return (
            <h1 className="flex items-center gap-2 overflow-hidden text-ellipsis whitespace-nowrap text-base font-normal text-grey-1">
                {icon && <Icon name={icon} size={10} className="min-w-fit" />} {title}
            </h1>
        )
    }

    const getAvatarIcon = useCallback((): IconName | undefined => {
        if (viewType === 'SUCCESS') return 'check'
        if (transactionType === 'WITHDRAW_BANK_ACCOUNT') return 'bank'
        if (recipientType !== 'USERNAME' || transactionType === 'ADD_MONEY' || transactionType === 'WITHDRAW')
            return 'wallet-outline'
        return undefined
    }, [])

    const getAvatarBackgroundColor = (): string => {
        if (viewType === 'SUCCESS') return '#29CC6A'
        if (
            transactionType === 'ADD_MONEY' ||
            (transactionType === 'WITHDRAW' && recipientType === 'USERNAME') ||
            recipientType === 'ADDRESS' ||
            recipientType === 'ENS' ||
            transactionType === 'WITHDRAW_BANK_ACCOUNT'
        )
            return '#FFC900'
        return getColorForUsername(recipientName).lightShade
    }

    const getAvatarTextColor = (): string => {
        if (
            viewType === 'SUCCESS' ||
            transactionType === 'ADD_MONEY' ||
            (transactionType === 'WITHDRAW' && recipientType === 'USERNAME') ||
            recipientType === 'ADDRESS' ||
            recipientType === 'ENS' ||
            transactionType === 'WITHDRAW_BANK_ACCOUNT'
        ) {
            return AVATAR_TEXT_DARK
        }
        return getColorForUsername(recipientName).darkShade
    }

    const isWithdrawBankAccount = transactionType === 'WITHDRAW_BANK_ACCOUNT' && recipientType === 'BANK_ACCOUNT'

    const withdrawBankIcon = () => {
        if (isWithdrawBankAccount)
            return (
                <div className="relative mr-1 h-12 w-12">
                    {countryCodeForFlag && (
                        <Image
                            src={`https://flagcdn.com/w320/${countryCodeForFlag}.png`}
                            alt={`${countryCodeForFlag} flag`}
                            width={160}
                            height={160}
                            className="h-12 w-12 rounded-full object-cover"
                        />
                    )}
                    <div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-yellow-400 p-1.5">
                        <Icon name="bank" className="h-full w-full text-black" />
                    </div>
                </div>
            )
        return undefined
    }

    return (
        <Card className={twMerge('flex items-center gap-3 p-4', className)}>
            <div className="flex items-center gap-3">
                {isWithdrawBankAccount ? (
                    withdrawBankIcon()
                ) : (
                    <AvatarWithBadge
                        icon={getAvatarIcon()}
                        size={avatarSize}
                        name={viewType === 'NORMAL' ? recipientName : undefined}
                        inlineStyle={{
                            backgroundColor: getAvatarBackgroundColor(),
                            color: getAvatarTextColor(),
                        }}
                    />
                )}
            </div>

            <div className="min-w-0 space-y-1">
                {getTitle()}
                <h2 className="text-2xl font-extrabold">
                    {tokenSymbol.toLowerCase() === PEANUT_WALLET_TOKEN_SYMBOL.toLowerCase() ? '$ ' : ''}
                    {amount}

                    {tokenSymbol.toLowerCase() !== PEANUT_WALLET_TOKEN_SYMBOL.toLowerCase() &&
                        ` ${tokenSymbol.toLowerCase() === 'pnt' ? (Number(amount) === 1 ? 'Beer' : 'Beers') : tokenSymbol}`}
                </h2>

                <Attachment message={message ?? ''} fileUrl={fileUrl ?? ''} />
            </div>
        </Card>
    )
}
