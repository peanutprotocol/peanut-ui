import AvatarWithBadge from '@/components/Profile/AvatarWithBadge'
import { PEANUT_WALLET_TOKEN_SYMBOL } from '@/constants'
import { getColorForUsername } from '@/utils/color.utils'
import { twMerge } from 'tailwind-merge'
import AddressLink from '../AddressLink'
import Card from '../Card'

interface PeanutActionDetailsCardProps {
    transactionType: 'SEND' | 'REQUEST' | 'RECEIVED_LINK' | 'CLAIM_LINK'
    recipientType: 'USERNAME' | 'ADDRESS'
    recipientName: string
    message?: string
    amount: string
    tokenSymbol: string
    viewType?: 'NORMAL' | 'SUCCESS'
    className?: HTMLDivElement['className']
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
}: PeanutActionDetailsCardProps) {
    const renderRecipient = () => {
        if (recipientType === 'USERNAME') return recipientName
        return <AddressLink className="text-base font-normal text-grey-1 no-underline" address={recipientName} />
    }

    const getTitle = () => {
        if (transactionType === 'SEND')
            return <h1 className="text-base font-normal text-grey-1">You paid {renderRecipient()}</h1>
        if (transactionType === 'REQUEST') return <h1 className="text-base font-normal text-grey-1">You requested</h1>
        if (transactionType === 'RECEIVED_LINK')
            return <h1 className="text-base font-normal text-grey-1">{renderRecipient()} sent you</h1>
        if (transactionType === 'CLAIM_LINK')
            return <h1 className="text-base font-normal text-grey-1">You just claimed</h1>
    }

    return (
        <Card className={twMerge('flex items-center gap-3 p-4', className)}>
            <div className="flex items-center gap-3">
                <AvatarWithBadge
                    icon={viewType === 'SUCCESS' ? 'check' : undefined}
                    size="medium"
                    name={viewType === 'NORMAL' ? recipientName : undefined}
                    inlineStyle={{
                        backgroundColor:
                            viewType === 'SUCCESS' ? '#29CC6A' : getColorForUsername(recipientName).backgroundColor,
                    }}
                />
            </div>

            <div className="space-y-1">
                {getTitle()}
                <h2 className="text-2xl font-extrabold">
                    {tokenSymbol.toLowerCase() === PEANUT_WALLET_TOKEN_SYMBOL.toLowerCase() ? '$' : ` ${tokenSymbol}`}
                    {amount}
                </h2>
                {message && <p className="text-sm font-medium text-grey-1">{message}</p>}
            </div>
        </Card>
    )
}
