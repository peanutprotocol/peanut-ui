'use client'

import StatusBadge, { StatusType } from '@/components/Global/Badges/StatusBadge'
import TransactionAvatarBadge from '@/components/TransactionDetails/TransactionAvatarBadge'
import { printableAddress } from '@/utils'
import React from 'react'
import { isAddress as isWalletAddress } from 'viem'
import Card from '../Global/Card'

export type TransactionDirection = 'send' | 'receive' | 'request_sent' | 'request_received' | 'withdraw' | 'add'

interface TransactionDetailsHeaderCardProps {
    direction: TransactionDirection
    userName: string
    amountDisplay: string
    initials: string
    status?: StatusType
    isVerified?: boolean
    isLinkTransaction?: boolean
}

const getTitle = (direction: TransactionDirection, userName: string, isLinkTransaction?: boolean): React.ReactNode => {
    let titleText = userName

    if (isLinkTransaction) {
        switch (direction) {
            case 'send':
            case 'request_sent':
                titleText = 'Sent via Link'
                break
            case 'receive':
            case 'request_received':
                titleText = 'Received via Link'
                break
            default:
                titleText = 'Link Transaction'
                break
        }
    } else {
        const isAddress = isWalletAddress(userName)
        userName = isAddress ? printableAddress(userName) : userName
        switch (direction) {
            case 'send':
                titleText = `Sending to ${userName}`
                break
            case 'request_received':
                titleText = `Paid request to ${userName}`
                break
            case 'receive':
                titleText = `Received from ${userName}`
                break
            case 'request_sent':
                titleText = `Requested from ${userName}`
                break
            case 'withdraw':
                titleText = `Withdrawing to ${userName}`
                break
            case 'add':
                titleText = `Added from ${userName}`
                break
            default:
                break
        }
    }

    return <span className="flex items-center gap-1">{titleText}</span>
}

export const TransactionDetailsHeaderCard: React.FC<TransactionDetailsHeaderCardProps> = ({
    direction,
    userName,
    amountDisplay,
    initials,
    status,
    isVerified = false,
    isLinkTransaction = false,
}) => {
    return (
        <Card className="relative p-4 md:p-6" position="single">
            <div className="flex items-center gap-3">
                <TransactionAvatarBadge
                    initials={initials}
                    userName={userName}
                    isLinkTransaction={isLinkTransaction}
                    isVerified={isVerified}
                    size="medium"
                />
                <div className="space-y-1">
                    <h2 className="text-sm font-medium text-grey-1">
                        {getTitle(direction, userName, isLinkTransaction)}
                    </h2>
                    <h1 className="text-3xl font-extrabold md:text-4xl">{amountDisplay}</h1>
                </div>
            </div>
            <div className="absolute bottom-4 right-4">{status && <StatusBadge status={status} size="small" />}</div>
        </Card>
    )
}
