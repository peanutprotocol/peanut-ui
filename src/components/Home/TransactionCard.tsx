import { Icon } from '@/components/Global/Icons/Icon'
import { formatExtendedNumber, printableUsdc } from '@/utils'
import React from 'react'

export type TransactionType = 'send' | 'withdraw' | 'add' | 'request'
export type TransactionStatus = 'completed' | 'pending'

interface TransactionCardProps {
    type: TransactionType
    name: string
    amount: bigint
    status: TransactionStatus
    initials?: string
}

const TransactionCard: React.FC<TransactionCardProps> = ({ type, name, amount, status, initials = '' }) => {
    // determine if amount should be displayed as positive or negative
    const isNegative = type === 'send' || type === 'withdraw'
    const displayAmount = isNegative
        ? `-$${formatExtendedNumber(printableUsdc(amount))}`
        : `+$${formatExtendedNumber(printableUsdc(amount))}`

    // for request and send type, show the raw amount without sign
    const finalAmount =
        type === 'request' || type === 'send' ? `$${formatExtendedNumber(printableUsdc(amount))}` : displayAmount

    return (
        <div className="w-full overflow-hidden border border-t-0  border-black bg-white px-4 py-2">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    {/* Icon or Initials based on transaction type */}
                    <div
                        className={`flex h-8 w-8 items-center justify-center rounded-full p-2 text-xs font-bold ${getIconBackgroundColor(type)}`}
                    >
                        {renderIcon(type, initials)}
                    </div>

                    <div className="flex flex-col">
                        <div className="max-w-40 truncate font-roboto text-sm font-medium">{name}</div>
                        <div className="flex items-center gap-1 text-gray-500">
                            {getActionIcon(type)}
                            <span className="text-[10px] capitalize">{type}</span>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col items-end space-y-0.5">
                    <span className="font-roboto text-xs font-medium">{finalAmount}</span>
                    <span
                        className={`rounded-full px-2 py-0.5 font-roboto text-[10px] font-semibold ${
                            status === 'completed' ? 'bg-success-2 text-success-1' : 'bg-secondary-4 text-secondary-1'
                        }`}
                    >
                        {status === 'completed' ? 'Completed' : 'Pending'}
                    </span>
                </div>
            </div>
        </div>
    )
}

// helper functions
function getIconBackgroundColor(type: TransactionType): string {
    switch (type) {
        case 'send':
        case 'request':
            return 'bg-success-1 text-black'
        case 'withdraw':
            return 'bg-black text-white'
        case 'add':
            return 'bg-black text-white'
        default:
            return 'bg-gray-200'
    }
}

function renderIcon(type: TransactionType, initials: string): React.ReactNode {
    switch (type) {
        case 'send':
        case 'request':
            return initials.substring(0, 2).toUpperCase()
        case 'withdraw':
            return <Icon name="bank" size={16} fill="white" />
        case 'add':
            return <Icon name="arrow-down" size={14} fill="white" />
        default:
            return null
    }
}

function getActionIcon(type: TransactionType): React.ReactNode {
    switch (type) {
        case 'send':
            return <Icon name="arrow-up-right" size={6} fill="currentColor" />
        case 'request':
            return <Icon name="arrow-down-left" size={6} fill="currentColor" />
        case 'withdraw':
            return <Icon name="arrow-up" size={8} fill="currentColor" />
        case 'add':
            return <Icon name="arrow-down" size={8} fill="currentColor" />
    }
}

export default TransactionCard
