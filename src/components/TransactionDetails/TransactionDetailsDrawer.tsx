import React, { useCallback, useRef } from 'react'
import BottomDrawer from '@/components/Global/BottomDrawer'
import { TransactionDetailsHeaderCard, TransactionDirection } from './TransactionDetailsHeaderCard'
import Card from '@/components/Global/Card'
import { PaymentInfoRow } from '@/components/Payment/PaymentInfoRow'
import { StatusType } from '../Global/Badges/StatusBadge'
import { Icon } from '../Global/Icons/Icon'
import Link from 'next/link'
import { formatAmount, formatDate, getInitialsFromName } from '@/utils'
import { useDynamicHeight } from '@/hooks/ui/useDynamicHeight'

// todo: temporary interface for transaction details, fix based on backend response
export interface TransactionDetails {
    id: string
    direction: TransactionDirection
    userName: string
    amount: number | bigint
    currencySymbol?: string
    tokenSymbol?: string
    initials: string
    status?: StatusType
    isVerified?: boolean
    date: string | Date
    fee?: number | string
    memo?: string
    txHash?: string
    explorerUrl?: string
    issueReportLink?: string
}

interface TransactionDetailsDrawerProps {
    isOpen: boolean
    onClose: () => void
    transaction: TransactionDetails | null
}

export const TransactionDetailsDrawer: React.FC<TransactionDetailsDrawerProps> = ({ isOpen, onClose, transaction }) => {
    const contentRef = useRef<HTMLDivElement>(null)

    // calculate drawer height based on content
    const drawerHeightVh = useDynamicHeight(contentRef, {
        maxHeightVh: 90,
        minHeightVh: 30,
        extraVhOffset: 5,
    })

    // default heights with fallback values
    const currentExpandedHeight = drawerHeightVh ?? 70
    const currentHalfHeight = Math.min(60, drawerHeightVh ?? 60)

    const handleClose = useCallback(() => {
        if (onClose) {
            onClose()
        }
    }, [onClose])

    if (!transaction) return null

    const amountDisplay = formatAmount(transaction.amount as number)
    const dateDisplay = formatDate(transaction.date as Date)
    const feeDisplay = transaction.fee !== undefined ? formatAmount(transaction.fee as number) : 'N/A'

    return (
        <BottomDrawer
            isOpen={isOpen}
            onClose={handleClose}
            initialPosition="expanded"
            collapsedHeight={5}
            halfHeight={currentHalfHeight}
            expandedHeight={currentExpandedHeight}
            preventScroll={true}
        >
            <div ref={contentRef} className="space-y-4 pb-8">
                {/* Top Header Card */}
                <TransactionDetailsHeaderCard
                    direction={transaction.direction}
                    userName={transaction.userName}
                    amountDisplay={amountDisplay}
                    initials={getInitialsFromName(transaction.userName)}
                    status={transaction.status}
                    isVerified={transaction.isVerified}
                />
                {/* Details Card */}
                <Card position="single" className="px-4 py-0" border={true}>
                    <div className="space-y-0">
                        <PaymentInfoRow label="Date" value={dateDisplay} />
                        {transaction.fee !== undefined && (
                            <PaymentInfoRow label="Fee" value={feeDisplay} hideBottomBorder={!transaction.memo} />
                        )}
                        {transaction.memo && <PaymentInfoRow label="Memo" value={transaction.memo} hideBottomBorder />}
                    </div>
                </Card>
                {/* support Link */}
                <div className="mt-4 flex items-center justify-center text-center">
                    <Link
                        href={'/support'}
                        className="inline-flex items-center gap-2 text-sm font-medium text-grey-1 underline transition-colors hover:text-black"
                    >
                        <Icon name="peanut-support" size={16} className="text-grey-1" />
                        Issues with this transaction?
                    </Link>
                </div>
            </div>
        </BottomDrawer>
    )
}
