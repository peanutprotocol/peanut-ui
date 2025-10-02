import Card, { CardPosition } from '@/components/Global/Card'
import { Icon, IconName } from '@/components/Global/Icons/Icon'
import TransactionAvatarBadge from '@/components/TransactionDetails/TransactionAvatarBadge'
import { TransactionDetailsDrawer } from '@/components/TransactionDetails/TransactionDetailsDrawer'
import { TransactionDirection } from '@/components/TransactionDetails/TransactionDetailsHeaderCard'
import { TransactionDetails } from '@/components/TransactionDetails/transactionTransformer'
import { useTransactionDetailsDrawer } from '@/hooks/useTransactionDetailsDrawer'
import {
    formatNumberForDisplay,
    formatCurrency,
    printableAddress,
    getAvatarUrl,
    getTransactionSign,
    isStableCoin,
    shortenStringLong,
} from '@/utils'
import React from 'react'
import Image from 'next/image'
import StatusPill, { StatusPillType } from '../Global/StatusPill'
import { VerifiedUserLabel } from '../UserHeader'
import { isAddress } from 'viem'

export type TransactionType =
    | 'send'
    | 'withdraw'
    | 'add'
    | 'request'
    | 'cashout'
    | 'receive'
    | 'bank_withdraw'
    | 'bank_deposit'
    | 'bank_request_fulfillment'
    | 'claim_external'
    | 'bank_claim'
    | 'pay'

interface TransactionCardProps {
    type: TransactionType
    name: string
    amount: number // For USD, this amount might come signed from mapTransactionDataForDrawer
    status?: StatusPillType
    initials?: string
    position?: CardPosition
    transaction: TransactionDetails
    isPending?: boolean
    haveSentMoneyToUser?: boolean
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
    haveSentMoneyToUser = false,
}) => {
    // hook to manage the state of the details drawer (open/closed, selected transaction)
    const { isDrawerOpen, selectedTransaction, openTransactionDetails, closeTransactionDetails } =
        useTransactionDetailsDrawer()

    const handleClick = () => {
        openTransactionDetails(transaction)
    }

    const isLinkTx = transaction.extraDataForDrawer?.isLinkTransaction ?? false
    const userNameForAvatar = transaction.fullName || transaction.userName
    const avatarUrl = getAvatarUrl(transaction)
    let displayName = name
    if (isAddress(displayName)) {
        displayName = printableAddress(displayName)
    } else if (type === 'pay' && displayName.length > 19) {
        displayName = shortenStringLong(displayName, 0, 16)
    }

    const sign = getTransactionSign(transaction)
    let usdAmount = amount
    if (!isStableCoin(transaction.tokenSymbol ?? 'USDC')) {
        usdAmount = Number(transaction.currency?.amount ?? amount)
    }
    const formattedAmount = formatCurrency(Math.abs(usdAmount).toString())
    const displayAmount = `${sign}$${formattedAmount}`

    let currencyDisplayAmount: string | undefined
    if (transaction.currency && transaction.currency.code.toUpperCase() !== 'USD') {
        const formattedCurrencyAmount = formatNumberForDisplay(transaction.currency.amount, { maxDecimals: 2 })
        currencyDisplayAmount = `≈ ${transaction.currency.code.toUpperCase()} ${formattedCurrencyAmount}`
    }

    return (
        <>
            {/* the clickable card */}
            <Card position={position} onClick={handleClick} className="cursor-pointer">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        {/* txn avatar component handles icon/initials/colors */}
                        {avatarUrl ? (
                            <div className={'relative flex h-12 w-12 items-center justify-center rounded-full'}>
                                <Image
                                    src={avatarUrl}
                                    alt="Icon"
                                    className="size-12 object-contain"
                                    width={30}
                                    height={30}
                                />

                                {status && <StatusPill status={status} />}
                            </div>
                        ) : (
                            <TransactionAvatarBadge
                                initials={initials}
                                userName={userNameForAvatar}
                                isLinkTransaction={isLinkTx}
                                transactionType={type}
                                context="card"
                                size="small"
                                status={status}
                            />
                        )}
                        <div className="flex flex-col">
                            {/* display formatted name (address or username) */}
                            <div className="flex flex-row items-center gap-2">
                                {isPending && <div className="h-2 w-2 animate-pulsate rounded-full bg-primary-1" />}
                                <div className="min-w-0 flex-1 truncate font-roboto text-[16px] font-medium">
                                    <VerifiedUserLabel
                                        name={displayName}
                                        isVerified={transaction.isVerified}
                                        haveSentMoneyToUser={haveSentMoneyToUser}
                                    />
                                </div>
                            </div>
                            {/* display the action icon and type text */}
                            <div className="flex items-center gap-1 text-sm font-medium text-gray-1">
                                {getActionIcon(type, transaction.direction)}
                                <span className="capitalize">{getActionText(type)}</span>
                            </div>
                        </div>
                    </div>

                    {/* amount and status on the right side */}
                    <div className="flex flex-col items-end">
                        <span className="font-semibold">{displayAmount}</span>
                        {currencyDisplayAmount && (
                            <span className="text-sm font-medium text-gray-1">{currencyDisplayAmount}</span>
                        )}
                    </div>
                </div>
            </Card>

            {/* Transaction Details Drawer */}
            <TransactionDetailsDrawer
                isOpen={isDrawerOpen && selectedTransaction?.id === transaction.id}
                onClose={closeTransactionDetails}
                transaction={selectedTransaction}
                transactionAmount={displayAmount}
                avatarUrl={avatarUrl}
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
        case 'claim_external':
        case 'bank_claim':
        case 'pay':
            iconName = 'arrow-up'
            iconSize = 8
            break
        case 'add':
        case 'bank_deposit':
            iconName = 'arrow-down'
            iconSize = 8
            break
        case 'bank_request_fulfillment':
            iconName = 'arrow-up-right'
            break
        default:
            return null
    }
    return <Icon name={iconName} size={iconSize} fill="currentColor" />
}

function getActionText(type: TransactionType): string {
    let actionText: string = type
    switch (type) {
        case 'bank_withdraw':
            actionText = 'Withdraw'
            break
        case 'bank_claim':
        case 'claim_external':
            actionText = 'Claim'
            break
        case 'bank_deposit':
            actionText = 'Add'
            break
        case 'bank_request_fulfillment':
            actionText = 'Request paid via bank'
            break
    }
    return actionText
}

export default TransactionCard
