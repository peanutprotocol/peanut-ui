import AvatarWithBadge, { AvatarSize } from '@/components/Profile/AvatarWithBadge'
import { PEANUT_WALLET_TOKEN_SYMBOL } from '@/constants'
import { getColorForUsername } from '@/utils/color.utils'
import { twMerge } from 'tailwind-merge'
import AddressLink from '../AddressLink'
import Attachment from '../Attachment'
import Card from '../Card'
import { Icon, IconName } from '../Icons/Icon'

interface PeanutActionDetailsCardProps {
    transactionType: 'REQUEST' | 'RECEIVED_LINK' | 'CLAIM_LINK' | 'REQUEST_PAYMENT' | 'ADD_MONEY' | 'WITHDRAW'
    recipientType: 'USERNAME' | 'ADDRESS'
    recipientName: string
    message?: string
    amount: string
    tokenSymbol: string
    viewType?: 'NORMAL' | 'SUCCESS'
    className?: HTMLDivElement['className']
    fileUrl?: string
    avatarSize?: AvatarSize
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
}: PeanutActionDetailsCardProps) {
    const renderRecipient = () => {
        if (recipientType === 'USERNAME') return recipientName
        return <AddressLink className="text-base font-normal text-grey-1 no-underline" address={recipientName} />
    }

    const getIcon = (): IconName | undefined => {
        if (transactionType === 'REQUEST_PAYMENT') return 'arrow-up-right'
        if (transactionType === 'ADD_MONEY') return 'arrow-down'
        if (transactionType === 'REQUEST' || transactionType === 'RECEIVED_LINK') return 'arrow-down-left'
        if (transactionType === 'CLAIM_LINK') return viewType !== 'SUCCESS' ? 'arrow-down' : undefined
        if (transactionType === 'WITHDRAW') return 'arrow-up'
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
        if (transactionType === 'ADD_MONEY') title = `Add money to Peanut`
        if (transactionType === 'WITHDRAW') title = `You're withdrawing`
        return (
            <h1 className="flex items-center gap-2 text-base font-normal text-grey-1">
                {icon && <Icon name={icon} size={10} />} {title}
            </h1>
        )
    }

    return (
        <Card className={twMerge('flex items-center gap-3 p-4', className)}>
            <div className="flex items-center gap-3">
                <AvatarWithBadge
                    icon={
                        viewType === 'SUCCESS'
                            ? 'check'
                            : recipientType !== 'USERNAME' ||
                                transactionType === 'ADD_MONEY' ||
                                transactionType === 'WITHDRAW'
                              ? 'wallet-outline'
                              : undefined
                    }
                    size={avatarSize}
                    name={viewType === 'NORMAL' ? recipientName : undefined}
                    inlineStyle={{
                        backgroundColor:
                            viewType === 'SUCCESS'
                                ? '#29CC6A'
                                : transactionType === 'ADD_MONEY'
                                  ? '#FFC900'
                                  : getColorForUsername(recipientName).backgroundColor,
                    }}
                />
            </div>

            <div className="space-y-1">
                {getTitle()}
                <h2 className="text-2xl font-extrabold">
                    {tokenSymbol.toLowerCase() === PEANUT_WALLET_TOKEN_SYMBOL.toLowerCase() ? '$ ' : ''}
                    {amount}

                    {tokenSymbol.toLowerCase() !== PEANUT_WALLET_TOKEN_SYMBOL.toLowerCase() && ` ${tokenSymbol}`}
                </h2>

                <Attachment message={message ?? ''} fileUrl={fileUrl ?? ''} />
            </div>
        </Card>
    )
}
