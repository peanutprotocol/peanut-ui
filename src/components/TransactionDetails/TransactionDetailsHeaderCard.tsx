import React from 'react'
import StatusBadge, { StatusType } from '@/components/Global/Badges/StatusBadge'
import AvatarWithBadge from '@/components/Profile/AvatarWithBadge'
import { Icon } from '@/components/Global/Icons/Icon'
import Card from '../Global/Card'

export type TransactionDirection = 'send' | 'receive' | 'request_sent' | 'request_received' | 'withdraw' | 'add'

interface TransactionDetailsHeaderCardProps {
    direction: TransactionDirection
    userName: string
    amountDisplay: string
    initials: string
    status?: StatusType
    isVerified?: boolean
}

const getTitle = (direction: TransactionDirection, userName: string): React.ReactNode => {
    switch (direction) {
        case 'send':
        case 'request_received':
            return (
                <span className="flex items-center gap-1">
                    <Icon name="arrow-up-right" size={12} className="text-grey-1" /> Sending to {userName}
                </span>
            )
        case 'receive':
        case 'request_sent':
            return (
                <span className="flex items-center gap-1">
                    <Icon name="arrow-down-left" size={12} className="text-grey-1" /> Received from {userName}
                </span>
            )
        case 'withdraw':
            return (
                <span className="flex items-center gap-1">
                    <Icon name="arrow-up" size={12} className="text-grey-1" /> Withdrawing to
                </span>
            )
        case 'add':
            return (
                <span className="flex items-center gap-1">
                    <Icon name="arrow-down" size={12} className="text-grey-1" /> Added from
                </span>
            )

        default:
            return userName
    }
}

export const TransactionDetailsHeaderCard: React.FC<TransactionDetailsHeaderCardProps> = ({
    direction,
    userName,
    amountDisplay,
    initials,
    status,
    isVerified = false,
}) => {
    return (
        <Card className="relative p-4 md:p-6" position="single">
            <div className="flex items-center gap-3">
                <AvatarWithBadge
                    initials={initials}
                    isVerified={isVerified}
                    size="medium"
                    achievementsBadgeSize="small"
                />
                <div className="space-y-1">
                    <h2 className="text-sm font-medium text-grey-1">{getTitle(direction, userName)}</h2>
                    <h1 className="text-3xl font-extrabold md:text-4xl">{amountDisplay}</h1>
                </div>
            </div>
            <div className="absolute bottom-4 right-4">{status && <StatusBadge status={status} size="small" />}</div>
        </Card>
    )
}
