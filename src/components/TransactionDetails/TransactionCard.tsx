import StatusBadge, { StatusType } from '@/components/Global/Badges/StatusBadge'
import Card, { CardPosition } from '@/components/Global/Card'
import { Icon, IconName } from '@/components/Global/Icons/Icon'
import TransactionAvatarBadge from '@/components/TransactionDetails/TransactionAvatarBadge'
import { TransactionDetailsDrawer } from '@/components/TransactionDetails/TransactionDetailsDrawer'
import { TransactionDetails } from '@/components/TransactionDetails/transactionTransformer'
import { useTransactionDetailsDrawer } from '@/hooks/useTransactionDetailsDrawer'
import { formatAmount, printableAddress } from '@/utils'
import React from 'react'
import { isAddress } from 'viem'

export type TransactionType = 'send' | 'withdraw' | 'add' | 'request'

interface TransactionCardProps {
    type: TransactionType
    name: string
    amount: number
    status?: StatusType
    initials?: string
    position?: CardPosition
    transaction: TransactionDetails
}

/**
 * component to display a single transaction entry in a list format.
 * it handles displaying the avatar/icon, name, amount, status,
 * and opens a transaction details drawer when clicked.
 */
const TransactionCard: React.FC<TransactionCardProps> = ({
    type,
    name,
    amount,
    status,
    initials = '',
    position = 'middle',
    transaction,
}) => {
    // hook to manage the state of the details drawer (open/closed, selected transaction)
    const { isDrawerOpen, selectedTransaction, openTransactionDetails, closeTransactionDetails } =
        useTransactionDetailsDrawer()

    // determine if amount should be positive or negative based on card type
    const isNegative = type === 'send' || type === 'withdraw'
    const displayAmount = isNegative ? `-$${formatAmount(amount)}` : `+$${formatAmount(amount)}`

    // for request/send types, always show positive amount with dollar sign
    const finalAmount = type === 'request' || type === 'send' ? `$${formatAmount(amount)}` : displayAmount

    const handleClick = () => {
        openTransactionDetails(transaction)
    }

    const isLinkTx = transaction.extraDataForDrawer?.isLinkTransaction ?? false
    const userNameForAvatar = transaction.userName // used by avatar for color hashing or type checking

    return (
        <>
            {/* the clickable card */}
            <Card position={position} onClick={handleClick}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        {/* txn avatar component handles icon/initials/colors */}
                        <TransactionAvatarBadge
                            initials={initials}
                            userName={userNameForAvatar}
                            isLinkTransaction={isLinkTx}
                            size="extra-small"
                        />
                        <div className="flex flex-col">
                            {/* display formatted name (address or username) */}
                            <div className="max-w-40 truncate font-roboto text-sm font-medium">
                                {isAddress(name) ? printableAddress(name) : name}
                            </div>
                            {/* display the action icon and type text */}
                            <div className="flex items-center gap-1 text-gray-500">
                                {getActionIcon(type)}
                                <span className="text-[10px] capitalize">{type}</span>
                            </div>
                        </div>
                    </div>

                    {/* amount and status on the right side */}
                    <div className="flex flex-col items-end space-y-0.5">
                        <span className="font-roboto text-xs font-medium">{finalAmount}</span>
                        {status && <StatusBadge status={status} />}
                    </div>
                </div>
            </Card>

            {/* Transaction Details Drawer */}
            <TransactionDetailsDrawer
                isOpen={isDrawerOpen && selectedTransaction?.id === transaction.id}
                onClose={closeTransactionDetails}
                transaction={selectedTransaction}
            />
        </>
    )
}

// helper functions
function getActionIcon(type: TransactionType): React.ReactNode {
    let iconName: IconName | null = null
    let iconSize = 6

    switch (type) {
        case 'send':
            iconName = 'arrow-up-right'
            break
        case 'request':
            iconName = 'arrow-down-left'
            break
        case 'withdraw':
            iconName = 'arrow-up'
            iconSize = 8
            break
        case 'add':
            iconName = 'arrow-down'
            iconSize = 8
            break
        default:
            return null
    }
    return <Icon name={iconName} size={iconSize} fill="currentColor" />
}

export default TransactionCard
