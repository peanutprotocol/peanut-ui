'use client'

import StatusBadge, { StatusType } from '@/components/Global/Badges/StatusBadge'
import TransactionAvatarBadge from '@/components/TransactionDetails/TransactionAvatarBadge'
import { TransactionType } from '@/components/TransactionDetails/TransactionCard'
import { printableAddress } from '@/utils'
import React from 'react'
import { isAddress as isWalletAddress } from 'viem'
import Card from '../Global/Card'
import { Icon, IconName } from '../Global/Icons/Icon'
import Image from 'next/image'

export type TransactionDirection = 'send' | 'receive' | 'request_sent' | 'request_received' | 'withdraw' | 'add'

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
}

const getTitle = (
    direction: TransactionDirection,
    userName: string,
    isLinkTransaction?: boolean,
    status?: StatusType
): React.ReactNode => {
    let titleText = userName

    if (isLinkTransaction && (status === 'pending' || status === 'cancelled' || !userName)) {
        switch (direction) {
            case 'send':
                titleText = 'Sent via Link'
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
        switch (direction) {
            case 'send':
                if (status === 'pending' || status === 'cancelled') {
                    titleText = displayName
                } else {
                    titleText = `${status === 'completed' ? 'Sent' : 'Sending'} to ${displayName}`
                }
                break
            case 'request_received':
                titleText = `${displayName} is requesting`
                break
            case 'receive':
                titleText = `Received from ${displayName}`
                break
            case 'request_sent':
                titleText = `${status === 'completed' ? 'Requested' : 'Requesting'} from ${displayName}`
                break
            case 'withdraw':
                titleText = `Withdrawing to ${displayName}`
                break
            case 'add':
                titleText = `Added from ${displayName}`
                break
            default:
                titleText = displayName
                break
        }
    }

    return <span className="flex items-center gap-1">{titleText}</span>
}

const getIcon = (direction: TransactionDirection, isLinkTransaction?: boolean): IconName | undefined => {
    if (isLinkTransaction) {
        return undefined
    }

    switch (direction) {
        case 'send':
            return 'arrow-up-right'
        case 'request_sent':
        case 'receive':
        case 'request_received':
            return 'arrow-down-left'
        case 'withdraw':
            return 'arrow-up'
        case 'add':
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
}) => {
    const typeForAvatar =
        transactionType ?? (direction === 'add' ? 'add' : direction === 'withdraw' ? 'withdraw' : 'send')

    const icon = getIcon(direction, isLinkTransaction)

    return (
        <Card className="relative p-4 md:p-6" position="single">
            <div className="flex items-center gap-3">
                {avatarUrl ? (
                    <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-black py-1 pl-4">
                        <Image src={avatarUrl} alt="Icon" className="object-contain" width={35} height={35} />
                    </div>
                ) : (
                    <TransactionAvatarBadge
                        initials={initials}
                        userName={userName}
                        isLinkTransaction={isLinkTransaction}
                        isVerified={isVerified}
                        transactionType={typeForAvatar}
                        context="header"
                        size="medium"
                    />
                )}
                <div className="space-y-1">
                    <h2 className="flex items-center gap-2 text-sm font-medium text-grey-1">
                        {icon && <Icon name={icon} size={10} />}
                        {getTitle(direction, userName, isLinkTransaction, status)}
                    </h2>
                    <h1
                        className={`text-3xl font-extrabold md:text-4xl ${status === 'cancelled' ? 'text-grey-1 line-through' : ''}`}
                    >
                        {amountDisplay}
                    </h1>
                </div>
            </div>
            <div className="absolute bottom-4 right-4">{status && <StatusBadge status={status} size="small" />}</div>
        </Card>
    )
}
