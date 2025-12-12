'use client'

import StatusBadge, { type StatusType } from '@/components/Global/Badges/StatusBadge'
import TransactionAvatarBadge from '@/components/TransactionDetails/TransactionAvatarBadge'
import { type TransactionType } from '@/components/TransactionDetails/TransactionCard'
import { printableAddress } from '@/utils/general.utils'
import Image from 'next/image'
import React from 'react'
import { isAddress as isWalletAddress } from 'viem'
import Card from '../Global/Card'
import { Icon, type IconName } from '../Global/Icons/Icon'
import { VerifiedUserLabel } from '../UserHeader'
import ProgressBar from '../Global/ProgressBar'
import { useRouter } from 'next/navigation'
import { twMerge } from 'tailwind-merge'
import { PEANUTMAN_LOGO } from '@/assets'

export type TransactionDirection =
    | 'send'
    | 'receive'
    | 'request_sent'
    | 'request_received'
    | 'withdraw'
    | 'add'
    | 'bank_withdraw'
    | 'bank_claim'
    | 'bank_deposit'
    | 'bank_request_fulfillment'
    | 'claim_external'
    | 'qr_payment'

interface TransactionDetailsHeaderCardProps {
    direction: TransactionDirection
    userName: string
    amountDisplay: string
    initials: string
    status?: StatusType
    isVerified?: boolean
    isLinkTransaction?: boolean
    transactionType?: TransactionType
    avatarUrl?: string
    haveSentMoneyToUser?: boolean
    isAvatarClickable?: boolean
    showProgessBar?: boolean
    progress?: number
    goal?: number
    isRequestPotTransaction?: boolean
    isTransactionClosed: boolean
    convertedAmount?: string
    showFullName?: boolean
    fullName?: string
}

const getTitle = (
    direction: TransactionDirection,
    userName: string,
    isLinkTransaction?: boolean,
    status?: StatusType
): React.ReactNode => {
    let titleText = userName

    if (isLinkTransaction && (status === 'pending' || status === 'cancelled' || !userName)) {
        const displayName = userName
        switch (direction) {
            case 'send':
                titleText = displayName
                break
            case 'request_sent':
                titleText = 'Requested via Link'
                break
            case 'receive':
            case 'request_received':
                titleText = 'Request via Link'
                break
            default:
                titleText = 'Link Transaction'
                break
        }
    } else {
        const isAddress = isWalletAddress(userName)
        const displayName = isAddress ? printableAddress(userName) : userName

        // check if this is a test transaction (setup confirmation)
        // note: bad check, but its a quick fix for now - kush (18 nov 2025), to be handled in the backend post devconnect.
        const isTestTransaction = displayName === 'Enjoy Peanut!'

        switch (direction) {
            case 'send':
                if (status === 'pending' || status === 'cancelled') {
                    titleText = displayName
                } else {
                    if (displayName === "You're sending via link") {
                        titleText = 'You sent via link'
                    } else {
                        titleText = `${status === 'completed' ? 'Sent' : 'Sending'} to ${displayName}`
                    }
                }
                break
            case 'request_received':
                titleText = `${displayName} is requesting`
                break
            case 'receive':
                if (displayName === 'Received via Link') {
                    titleText = 'You received via link'
                } else {
                    titleText = `Received from ${displayName}`
                }
                break
            case 'request_sent':
                titleText = `${status === 'completed' ? 'Requested' : 'Requesting'} from ${displayName}`
                break
            case 'withdraw':
            case 'bank_withdraw':
                titleText = `${status === 'completed' ? 'Withdrew' : 'Withdrawing'} to ${displayName}`
                break
            case 'bank_claim':
                titleText = displayName
                break
            case 'add':
            case 'bank_deposit':
                if (isTestTransaction) {
                    titleText = 'Enjoy Peanut!'
                } else {
                    titleText = `${status === 'completed' ? 'Added' : 'Adding'} from ${displayName}`
                }
                break
            case 'claim_external':
                if (status === 'completed') {
                    titleText = `Claimed to ${displayName}`
                } else if (status === 'failed') {
                    titleText = `Claim to ${displayName}`
                } else {
                    titleText = `Claiming to ${displayName}`
                }
                break
            case 'qr_payment':
                if (status === 'completed') {
                    titleText = `Paid to ${displayName}`
                } else if (status === 'failed') {
                    titleText = `Payment to ${displayName}`
                } else {
                    titleText = `Paying to ${displayName}`
                }
                break
            default:
                titleText = displayName
                break
        }
    }

    return titleText
}

const getIcon = (
    direction: TransactionDirection,
    isLinkTransaction?: boolean,
    isTestTransaction?: boolean
): IconName | undefined => {
    if (isLinkTransaction || isTestTransaction) {
        return undefined
    }

    switch (direction) {
        case 'send':
        case 'bank_request_fulfillment':
        case 'qr_payment':
            return 'arrow-up-right'
        case 'request_sent':
        case 'receive':
        case 'request_received':
            return 'arrow-down-left'
        case 'withdraw':
        case 'bank_claim':
        case 'claim_external':
            return 'arrow-up'
        case 'add':
        case 'bank_deposit':
            return 'arrow-down'
        default:
            return undefined
    }
}

export const TransactionDetailsHeaderCard: React.FC<TransactionDetailsHeaderCardProps> = ({
    direction,
    userName,
    amountDisplay,
    initials,
    status,
    isVerified = false,
    isLinkTransaction = false,
    transactionType,
    avatarUrl,
    haveSentMoneyToUser = false,
    isAvatarClickable = false,
    showProgessBar = false,
    progress,
    goal,
    isRequestPotTransaction,
    isTransactionClosed,
    convertedAmount,
    showFullName,
    fullName,
}) => {
    const router = useRouter()
    const typeForAvatar =
        transactionType ?? (direction === 'add' ? 'add' : direction === 'withdraw' ? 'withdraw' : 'send')

    // respect user's showFullName preference: use fullName only if showFullName is true, otherwise use username
    const nameForAvatar = showFullName && fullName ? fullName : userName

    // check if this is a test transaction (setup confirmation)
    const isTestTransaction = userName === 'Enjoy Peanut!'
    const icon = getIcon(direction, isLinkTransaction, isTestTransaction)

    const handleUserPfpClick = () => {
        if (isAvatarClickable) {
            router.push(`/${userName}`)
        }
    }

    const isNoGoalSet = isRequestPotTransaction && goal === 0

    return (
        <Card className="relative p-4 md:p-6" position="single">
            {isTestTransaction ? (
                <div className="flex items-center gap-3">
                    <div>
                        <Image src={PEANUTMAN_LOGO} alt="Peanut Logo" width={64} height={64} className="size-8" />
                    </div>
                    <div>
                        <h2 className="text-xl font-extrabold">Enjoy Peanut!</h2>
                    </div>
                </div>
            ) : (
                <div className="flex items-center gap-3">
                    <div className={twMerge(isAvatarClickable && 'cursor-pointer')} onClick={handleUserPfpClick}>
                        {avatarUrl ? (
                            <div className="flex h-16 w-16 items-center justify-center rounded-full">
                                <Image
                                    src={avatarUrl}
                                    alt="Icon"
                                    className="size-full rounded-full object-cover"
                                    width={160}
                                    height={160}
                                />
                            </div>
                        ) : (
                            <TransactionAvatarBadge
                                initials={initials}
                                userName={nameForAvatar}
                                isLinkTransaction={isLinkTransaction}
                                transactionType={typeForAvatar}
                                context="header"
                                size="small"
                            />
                        )}
                    </div>
                    <div className="w-full space-y-1">
                        <h2 className="flex items-center gap-2 text-sm font-medium text-grey-1">
                            {icon && <Icon name={icon} size={10} />}
                            <VerifiedUserLabel
                                username={userName}
                                name={
                                    isRequestPotTransaction
                                        ? userName
                                        : (getTitle(direction, userName, isLinkTransaction, status) as string)
                                }
                                isVerified={isVerified}
                                className="flex items-center gap-1"
                                haveSentMoneyToUser={haveSentMoneyToUser}
                                iconSize={18}
                                onNameClick={isAvatarClickable ? handleUserPfpClick : undefined}
                            />

                            <div className="ml-auto">
                                {status && <StatusBadge status={status} size="small" className="py-0" />}
                            </div>
                        </h2>
                        <h1
                            className={twMerge(
                                'text-3xl font-extrabold md:text-4xl',
                                status === 'cancelled' && 'text-grey-1 line-through',
                                isNoGoalSet && 'text-xl text-black md:text-3xl'
                            )}
                        >
                            {amountDisplay}
                        </h1>

                        {convertedAmount && <h2 className="font-bold">≈ {convertedAmount}</h2>}

                        {isNoGoalSet && <h4 className="text-sm font-medium text-black">No goal set</h4>}
                    </div>
                </div>
            )}

            {!isNoGoalSet && showProgessBar && goal !== undefined && progress !== undefined && (
                <div className="mt-4">
                    <ProgressBar goal={goal} progress={progress} isClosed={isTransactionClosed} />
                </div>
            )}
        </Card>
    )
}
