import StatusBadge, { StatusType } from '@/components/Global/Badges/StatusBadge'
import Card, { CardPosition } from '@/components/Global/Card'
import { Icon, IconName } from '@/components/Global/Icons/Icon'
import TransactionAvatarBadge from '@/components/TransactionDetails/TransactionAvatarBadge'
import { TransactionDetailsDrawer } from '@/components/TransactionDetails/TransactionDetailsDrawer'
import { TransactionDirection } from '@/components/TransactionDetails/TransactionDetailsHeaderCard'
import { TransactionDetails } from '@/components/TransactionDetails/transactionTransformer'
import { useTransactionDetailsDrawer } from '@/hooks/useTransactionDetailsDrawer'
import { EHistoryEntryType, EHistoryUserRole } from '@/hooks/useTransactionHistory'
import { formatNumberForDisplay } from '@/utils'
import { getDisplayCurrencySymbol } from '@/utils/currency'
import React from 'react'
import AddressLink from '../Global/AddressLink'
import { STABLE_COINS } from '@/constants'
import Image from 'next/image'

export type TransactionType = 'send' | 'withdraw' | 'add' | 'request' | 'cashout' | 'receive' | 'bank_withdraw'

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
    const avatarUrl = transaction.extraDataForDrawer?.rewardData?.avatarUrl

    let finalDisplayAmount = ''
    const actualCurrencyCode = transaction.currency?.code
    const defaultDisplayDecimals = actualCurrencyCode === 'JPY' ? 0 : 2 // JPY has 0, others default to 2

    if (actualCurrencyCode === 'ARS' && transaction.currency?.amount) {
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
                originalType === EHistoryEntryType.SEND_LINK ||
                originalType === EHistoryEntryType.DIRECT_SEND)
        ) {
            arsSign = '+'
        }
        finalDisplayAmount = `${arsSign}${getDisplayCurrencySymbol('ARS')}${formatNumberForDisplay(transaction.currency.amount, { maxDecimals: defaultDisplayDecimals })}`
    } else {
        const isStableCoin = transaction.tokenSymbol && STABLE_COINS.includes(transaction.tokenSymbol)
        const displaySymbol =
            transaction.tokenSymbol && !isStableCoin && !actualCurrencyCode // If it's a token amount not a fiat currency
                ? '' // No currency symbol prefix for tokens like ETH, BNB, just the amount and then tokenSymbol
                : transaction.currencySymbol || getDisplayCurrencySymbol(actualCurrencyCode) // Use provided sign+symbol or derive symbol

        let amountString = Math.abs(amount).toString()
        // If it's a token and not USD/ARS, transaction.tokenSymbol should be displayed after amount.
        // And `displayDecimals` might need to come from token itself if available, else default.
        const decimalsForDisplay = actualCurrencyCode // If it's a known currency (USD, ARS)
            ? defaultDisplayDecimals
            : transaction.extraDataForDrawer?.originalType === EHistoryEntryType.SEND_LINK // Example: check token specific decimals if available
              ? ((transaction.extraDataForDrawer as any)?.tokenDecimalsForDisplay ?? 6) // Fallback to 6 for tokens
              : 6 // General fallback for other tokens

        finalDisplayAmount = `${displaySymbol}${formatNumberForDisplay(amountString, { maxDecimals: decimalsForDisplay })}`
        if (!isStableCoin && !actualCurrencyCode) {
            // Append token symbol if it's a token transaction

            finalDisplayAmount = `${displaySymbol}${finalDisplayAmount} ${transaction.tokenSymbol}`
        }
    }

    return (
        <>
            {/* the clickable card */}
            <Card position={position} onClick={handleClick} className="cursor-pointer">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        {/* txn avatar component handles icon/initials/colors */}
                        {avatarUrl ? (
                            <div
                                className={
                                    'flex h-12 w-12 items-center justify-center rounded-full border border-black bg-white py-2.5 pl-3.5 pr-0.5'
                                }
                            >
                                <Image
                                    src={avatarUrl}
                                    alt="Icon"
                                    className="size-6 object-contain"
                                    width={30}
                                    height={30}
                                />
                            </div>
                        ) : (
                            <TransactionAvatarBadge
                                initials={initials}
                                userName={userNameForAvatar}
                                isLinkTransaction={isLinkTx}
                                transactionType={type}
                                context="card"
                                size="small"
                            />
                        )}
                        <div className="flex flex-col">
                            {/* display formatted name (address or username) */}
                            <div className="flex flex-row items-center gap-2">
                                {isPending && <div className="h-2 w-2 animate-pulsate rounded-full bg-primary-1" />}
                                <div className="max-w-40 truncate font-roboto text-[16px] font-medium">
                                    <AddressLink address={name} isLink={false} />
                                </div>
                            </div>
                            {/* display the action icon and type text */}
                            <div className="flex items-center gap-1 text-gray-500">
                                {getActionIcon(type, transaction.direction)}
                                <span className="text-[14px] capitalize">
                                    {type === 'bank_withdraw' ? 'Withdraw' : type}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* amount and status on the right side */}
                    <div className="flex flex-col items-end space-y-1">
                        <span className="font-roboto text-[16px] font-medium">{finalDisplayAmount}</span>
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
    let iconSize = 8

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
        case 'bank_withdraw':
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
