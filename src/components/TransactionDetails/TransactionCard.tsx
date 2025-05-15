import StatusBadge, { StatusType } from '@/components/Global/Badges/StatusBadge'
import Card, { CardPosition } from '@/components/Global/Card'
import { Icon, IconName } from '@/components/Global/Icons/Icon'
import TransactionAvatarBadge from '@/components/TransactionDetails/TransactionAvatarBadge'
import { TransactionDetailsDrawer } from '@/components/TransactionDetails/TransactionDetailsDrawer'
import { TransactionDirection } from '@/components/TransactionDetails/TransactionDetailsHeaderCard'
import { TransactionDetails } from '@/components/TransactionDetails/transactionTransformer'
import { useTransactionDetailsDrawer } from '@/hooks/useTransactionDetailsDrawer'
import { formatNumberForDisplay, printableAddress } from '@/utils'
import React from 'react'
import { isAddress } from 'viem'
import { EHistoryEntryType, EHistoryUserRole } from '@/hooks/useTransactionHistory'

export type TransactionType = 'send' | 'withdraw' | 'add' | 'request' | 'cashout' | 'receive'

interface TransactionCardProps {
    type: TransactionType
    name: string
    amount: number // For USD, this amount might come signed from mapTransactionDataForDrawer
    status?: StatusType
    initials?: string
    position?: CardPosition
    transaction: TransactionDetails
    isPending?: boolean
}

// Helper function to get currency symbol based on code - can be moved to utils if used elsewhere
const getDisplayCurrencySymbol = (code?: string, fallbackSymbol: string = '$'): string => {
    if (code === 'ARS') return 'AR$'
    if (code === 'USD') return '$'
    return fallbackSymbol
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
    isPending = false,
}) => {
    // hook to manage the state of the details drawer (open/closed, selected transaction)
    const { isDrawerOpen, selectedTransaction, openTransactionDetails, closeTransactionDetails } =
        useTransactionDetailsDrawer()

    const handleClick = () => {
        openTransactionDetails(transaction)
    }

    const isLinkTx = transaction.extraDataForDrawer?.isLinkTransaction ?? false
    const userNameForAvatar = transaction.userName

    // --- Determine Display Amount with Sign and Currency ---
    // This logic constructs the final string for the transaction amount, including its sign (+/-)
    // and currency symbol (e.g., AR$, $), ensuring consistent formatting.
    let finalDisplayAmount = ''
    const actualCurrencyCode = transaction.currency?.code

    if (actualCurrencyCode === 'ARS' && transaction.currency?.amount) {
        // Logic for ARS transactions:
        // 1. Determine the sign (+/-) based on the user's role (sender/recipient) and the transaction type.
        // 2. Get the ARS currency symbol.
        // 3. Format the ARS amount string with thousands separators and appropriate decimals.
        // 4. Combine sign, symbol, and formatted amount.
        let arsSign = ''
        const originalType = transaction.extraDataForDrawer?.originalType as EHistoryEntryType | undefined
        const originalUserRole = transaction.extraDataForDrawer?.originalUserRole as EHistoryUserRole | undefined

        if (
            originalUserRole === EHistoryUserRole.SENDER &&
            (originalType === EHistoryEntryType.SEND_LINK ||
                originalType === EHistoryEntryType.DIRECT_SEND ||
                originalType === EHistoryEntryType.CASHOUT)
        ) {
            arsSign = '-'
        } else if (
            originalUserRole === EHistoryUserRole.RECIPIENT &&
            (originalType === EHistoryEntryType.DEPOSIT ||
                originalType === EHistoryEntryType.SEND_LINK || // Covers claimed links
                originalType === EHistoryEntryType.DIRECT_SEND)
        ) {
            // Covers received direct sends
            arsSign = '+'
        }
        finalDisplayAmount = `${arsSign}${getDisplayCurrencySymbol('ARS')}${formatNumberForDisplay(transaction.currency.amount)}`
    } else {
        // Logic for USD or other primary (non-ARS) currency transactions:
        // Assumes `transaction.currencySymbol` (e.g., "+$" or "-$") is provided by `mapTransactionDataForDrawer`
        // and already includes the correct sign and base symbol.
        // The numeric `amount` prop is made absolute, and then formatted.
        // This ensures that the sign comes from `transaction.currencySymbol` and the number formatting is clean.
        finalDisplayAmount = `${transaction.currencySymbol || '$'}${formatNumberForDisplay(Math.abs(amount).toString())}`
    }
    // --- End of Display Amount Logic ---

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
                            transactionType={type}
                            context="card"
                            size="extra-small"
                        />
                        <div className="flex flex-col">
                            {/* display formatted name (address or username) */}
                            <div className="flex flex-row items-center gap-2">
                                {isPending && <div className="animate-pulsate h-2 w-2 rounded-full bg-pink-1" />}
                                <div className="max-w-40 truncate font-roboto text-sm font-medium">
                                    {isAddress(name) ? printableAddress(name) : name}
                                </div>
                            </div>
                            {/* display the action icon and type text */}
                            <div className="flex items-center gap-1 text-gray-500">
                                {getActionIcon(type, transaction.direction)}
                                <span className="text-[10px] capitalize">{type}</span>
                            </div>
                        </div>
                    </div>

                    {/* amount and status on the right side */}
                    <div className="flex flex-col items-end space-y-0.5">
                        <span className="font-roboto text-xs font-medium">{finalDisplayAmount}</span>
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
function getActionIcon(type: TransactionType, direction: TransactionDirection): React.ReactNode {
    let iconName: IconName | null = null
    let iconSize = 6

    switch (type) {
        case 'send':
            iconName = 'arrow-up-right'
            break
        case 'request':
            if (direction === 'request_received') {
                iconName = 'arrow-up-right'
            } else {
                iconName = 'arrow-down-left'
            }
            break
        case 'receive':
            iconName = 'arrow-down-left'
            break
        case 'withdraw':
        case 'cashout':
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
