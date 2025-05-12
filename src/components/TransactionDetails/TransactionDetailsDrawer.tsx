import BottomDrawer from '@/components/Global/BottomDrawer'
import Card from '@/components/Global/Card'
import { PaymentInfoRow } from '@/components/Payment/PaymentInfoRow'
import { TransactionDetails } from '@/components/TransactionDetails/transactionTransformer'
import { useDynamicHeight } from '@/hooks/ui/useDynamicHeight'
import { EHistoryEntryType, EHistoryUserRole } from '@/hooks/useTransactionHistory'
import { formatAmount, formatDate, getInitialsFromName } from '@/utils'
import Link from 'next/link'
import React, { useCallback, useRef, useState } from 'react'
import { Button } from '../0_Bruddle'
import { Icon } from '../Global/Icons/Icon'
import QRCodeWrapper from '../Global/QRCodeWrapper'
import ShareButton from '../Global/ShareButton'
import { TransactionDetailsHeaderCard } from './TransactionDetailsHeaderCard'
import { sendLinksApi } from '@/services/sendLinks'
import { useUserStore } from '@/redux/hooks'
import { useQueryClient } from '@tanstack/react-query'
import { useWallet } from '@/hooks/wallet/useWallet'
import { captureException } from '@sentry/nextjs'

interface TransactionDetailsDrawerProps {
    isOpen: boolean
    onClose: () => void
    /** the transaction data to display, or null if none selected. */
    transaction: TransactionDetails | null
}

/**
 * a bottom drawer component that displays detailed information about a specific transaction.
 * includes header, details card, and conditional qr/sharing options for pending transactions.
 */
export const TransactionDetailsDrawer: React.FC<TransactionDetailsDrawerProps> = ({ isOpen, onClose, transaction }) => {
    // ref for the main content area to calculate dynamic height
    const contentRef = useRef<HTMLDivElement>(null)
    const { user } = useUserStore()
    const queryClient = useQueryClient()
    const [isLoading, setIsLoading] = useState<boolean>(false)
    const { fetchBalance } = useWallet()

    // calculate drawer height based on content, with min/max constraints
    const drawerHeightVh = useDynamicHeight(contentRef, {
        maxHeightVh: 90, // max 90% of viewport height
        minHeightVh: 30, // min 30% of viewport height
        extraVhOffset: 10, // some extra padding to the calculated height
    })

    // determine the heights for the drawer states (expanded, half)
    const currentExpandedHeight = drawerHeightVh ?? 85 // use calculated height or fallback
    const currentHalfHeight = Math.min(60, drawerHeightVh ?? 60) // half height, capped at 60vh or calculated height

    const handleClose = useCallback(() => {
        if (onClose) {
            onClose()
        }
    }, [onClose])

    if (!transaction) return null

    // format data for display
    const amountDisplay = formatAmount(transaction.amount as number)
    const dateDisplay = formatDate(transaction.date as Date)
    const feeDisplay = transaction.fee !== undefined ? formatAmount(transaction.fee as number) : 'N/A'

    // determine if the qr code and sharing section should be shown
    // conditions: status is pending, there's a link, and it's a send_link/request sent by the user, or a request received by the user.
    const shouldShowQrShare =
        transaction.status === 'pending' &&
        transaction.extraDataForDrawer?.link &&
        ((transaction.extraDataForDrawer.originalType === EHistoryEntryType.SEND_LINK &&
            transaction.extraDataForDrawer.originalUserRole === EHistoryUserRole.SENDER) ||
            (transaction.extraDataForDrawer.originalType === EHistoryEntryType.REQUEST &&
                transaction.extraDataForDrawer.originalUserRole === EHistoryUserRole.SENDER) ||
            (transaction.extraDataForDrawer.originalType === EHistoryEntryType.REQUEST &&
                transaction.extraDataForDrawer.originalUserRole === EHistoryUserRole.RECIPIENT))

    return (
        <BottomDrawer
            isOpen={isOpen}
            onClose={handleClose}
            initialPosition="expanded"
            collapsedHeight={5}
            halfHeight={currentHalfHeight}
            expandedHeight={currentExpandedHeight}
            preventScroll={false}
            isLoading={isLoading}
        >
            <div ref={contentRef} className="space-y-4 pb-8">
                {/* show qr code at the top if applicable */}
                {shouldShowQrShare && transaction.extraDataForDrawer?.link && (
                    <QRCodeWrapper url={transaction.extraDataForDrawer.link} />
                )}

                {/* transaction header card */}
                <TransactionDetailsHeaderCard
                    direction={transaction.direction}
                    userName={transaction.userName}
                    amountDisplay={amountDisplay}
                    initials={getInitialsFromName(transaction.userName)}
                    status={transaction.status}
                    isVerified={transaction.isVerified}
                    isLinkTransaction={transaction.extraDataForDrawer?.isLinkTransaction}
                    transactionType={transaction.extraDataForDrawer?.transactionCardType}
                />

                {/* details card (date, fee, memo) */}
                <Card position={shouldShowQrShare ? 'first' : 'single'} className="px-4 py-0" border={true}>
                    <div className="space-y-0">
                        {dateDisplay && (
                            <PaymentInfoRow
                                label="Date"
                                value={dateDisplay}
                                hideBottomBorder={!transaction.fee && !transaction.memo}
                            />
                        )}
                        {transaction.fee !== undefined && (
                            <PaymentInfoRow label="Fee" value={feeDisplay} hideBottomBorder={!transaction.memo} />
                        )}
                        {transaction.memo && <PaymentInfoRow label="Memo" value={transaction.memo} hideBottomBorder />}
                    </div>
                </Card>

                {/* share and cancel buttons section (only if qr is shown) */}
                {shouldShowQrShare && transaction.extraDataForDrawer?.link && (
                    <div className="space-y-2">
                        {' '}
                        {/* added space-y for button separation */}
                        <ShareButton url={transaction.extraDataForDrawer.link} title="share transaction">
                            Share Link
                        </ShareButton>
                        {/* show cancel button only if the current user sent the link/request */}
                        {(transaction.extraDataForDrawer.originalType === EHistoryEntryType.SEND_LINK ||
                            transaction.extraDataForDrawer.originalType === EHistoryEntryType.REQUEST) &&
                            transaction.extraDataForDrawer.originalUserRole === EHistoryUserRole.SENDER && (
                                <Button
                                    onClick={() => {
                                        setIsLoading(true)
                                        sendLinksApi
                                            .claim(user!.user.username!, transaction.extraDataForDrawer!.link!)
                                            .then(() => {
                                                // Claiming takes time, so we need to invalidate both transaction query types
                                                setTimeout(() => {
                                                    fetchBalance()
                                                    queryClient
                                                        .invalidateQueries({
                                                            queryKey: ['transactions'],
                                                        })
                                                        .then(() => {
                                                            setIsLoading(false)
                                                            handleClose()
                                                        })
                                                }, 3000)
                                            })
                                            .catch((error) => {
                                                captureException(error)
                                                console.error('Error claiming link:', error)
                                                setIsLoading(false)
                                            })
                                    }}
                                    variant={'primary-soft'}
                                    className="flex w-full items-center gap-1"
                                    shadowSize="4"
                                >
                                    <div className="flex size-6 items-center gap-0">
                                        <Icon name="cancel" />
                                    </div>
                                    <span>Cancel link</span>
                                </Button>
                            )}
                    </div>
                )}

                {/* support link section */}
                <Link
                    href={'/support'}
                    className="flex items-center justify-center gap-2 text-sm font-medium text-grey-1 underline transition-colors hover:text-black"
                >
                    <Icon name="peanut-support" size={16} className="text-grey-1" />
                    Issues with this transaction?
                </Link>
            </div>
        </BottomDrawer>
    )
}
