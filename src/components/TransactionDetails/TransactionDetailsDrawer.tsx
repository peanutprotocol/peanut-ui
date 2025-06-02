import BottomDrawer from '@/components/Global/BottomDrawer'
import Card from '@/components/Global/Card'
import { PaymentInfoRow } from '@/components/Payment/PaymentInfoRow'
import { TransactionDetails } from '@/components/TransactionDetails/transactionTransformer'
import { TRANSACTIONS } from '@/constants/query.consts'
import { useDynamicHeight } from '@/hooks/ui/useDynamicHeight'
import { EHistoryEntryType, EHistoryUserRole } from '@/hooks/useTransactionHistory'
import { useWallet } from '@/hooks/wallet/useWallet'
import { useUserStore } from '@/redux/hooks'
import { chargesApi } from '@/services/charges'
import { sendLinksApi } from '@/services/sendLinks'
import { formatAmount, formatDate, getInitialsFromName } from '@/utils'
import { captureException } from '@sentry/nextjs'
import { useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import React, { useCallback, useMemo, useRef, useState } from 'react'
import { Button } from '../0_Bruddle'
import DisplayIcon from '../Global/DisplayIcon'
import { Icon } from '../Global/Icons/Icon'
import QRCodeWrapper from '../Global/QRCodeWrapper'
import ShareButton from '../Global/ShareButton'
import { TransactionDetailsHeaderCard } from './TransactionDetailsHeaderCard'

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
    const [isLoading, setIsLoading] = useState<boolean>(false)

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
            <TransactionDetailsReceipt
                transaction={transaction}
                onClose={handleClose}
                setIsLoading={setIsLoading}
                contentRef={contentRef}
            />
        </BottomDrawer>
    )
}

export const TransactionDetailsReceipt = ({
    transaction,
    onClose,
    setIsLoading,
    contentRef,
}: {
    transaction: TransactionDetails | null
    onClose?: () => void
    setIsLoading?: (isLoading: boolean) => void
    contentRef?: React.RefObject<HTMLDivElement>
}) => {
    // ref for the main content area to calculate dynamic height
    const { user } = useUserStore()
    const queryClient = useQueryClient()
    const { fetchBalance } = useWallet()

    const isPendingRequestee = useMemo(() => {
        if (!transaction) return false
        return (
            transaction.status === 'pending' &&
            transaction.extraDataForDrawer?.originalType === EHistoryEntryType.REQUEST &&
            transaction.extraDataForDrawer?.originalUserRole === EHistoryUserRole.SENDER
        )
    }, [transaction])

    const isPendingRequester = useMemo(() => {
        if (!transaction) return false
        return (
            transaction.status === 'pending' &&
            transaction.extraDataForDrawer?.originalType === EHistoryEntryType.REQUEST &&
            transaction.extraDataForDrawer?.originalUserRole === EHistoryUserRole.RECIPIENT
        )
    }, [transaction])

    const isPendingSentLink = useMemo(() => {
        if (!transaction) return false
        return (
            transaction.status === 'pending' &&
            transaction.extraDataForDrawer?.originalType === EHistoryEntryType.SEND_LINK &&
            transaction.extraDataForDrawer?.originalUserRole === EHistoryUserRole.SENDER
        )
    }, [transaction])

    const shouldShowShareReceipt = useMemo(() => {
        if (!transaction || isPendingSentLink || isPendingRequester || isPendingRequestee) return false
        if (transaction?.txHash && transaction.direction !== 'receive' && transaction.direction !== 'request_sent')
            return true
        return false
    }, [transaction, isPendingSentLink, isPendingRequester, isPendingRequestee])

    if (!transaction) return null

    // format data for display
    const amountDisplay = transaction.extraDataForDrawer?.rewardData
        ? transaction.extraDataForDrawer.rewardData.formatAmount(transaction.amount)
        : `$ ${formatAmount(transaction.amount as number)}`
    const feeDisplay = transaction.fee !== undefined ? formatAmount(transaction.fee as number) : 'N/A'

    // determine if the qr code and sharing section should be shown
    // conditions: status is pending, there's a link, and it's a send_link/request sent by the user, or a request received by the user.
    const shouldShowQrShare =
        transaction.status === 'pending' &&
        transaction.extraDataForDrawer?.link &&
        ((transaction.extraDataForDrawer.originalType === EHistoryEntryType.SEND_LINK &&
            transaction.extraDataForDrawer.originalUserRole === EHistoryUserRole.SENDER) ||
            (transaction.extraDataForDrawer.originalType === EHistoryEntryType.REQUEST &&
                transaction.extraDataForDrawer.originalUserRole === EHistoryUserRole.RECIPIENT))

    return (
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
                avatarUrl={transaction.extraDataForDrawer?.rewardData?.avatarUrl}
            />

            {/* details card (date, fee, memo) and more */}
            <Card position={shouldShowQrShare ? 'first' : 'single'} className="px-4 py-0" border={true}>
                <div className="space-y-0">
                    {transaction.date && (
                        <PaymentInfoRow
                            label={transaction.status === 'cancelled' ? 'Created' : 'Date'}
                            value={formatDate(transaction.date as Date)}
                            hideBottomBorder={
                                !transaction.tokenDisplayDetails &&
                                !transaction.cancelledDate &&
                                !transaction.fee &&
                                !transaction.memo &&
                                !transaction.attachmentUrl &&
                                transaction.status === 'pending'
                            }
                        />
                    )}

                    {transaction.tokenDisplayDetails && transaction.sourceView === 'history' && (
                        <PaymentInfoRow
                            label="Token and network"
                            value={
                                <div className="flex items-center gap-2">
                                    <div className="relative flex h-6 w-6 min-w-[24px] items-center justify-center">
                                        {/* Main token icon */}
                                        <DisplayIcon
                                            iconUrl={transaction.tokenDisplayDetails.tokenIconUrl}
                                            altText={transaction.tokenDisplayDetails.tokenSymbol || 'token'}
                                            fallbackName={transaction.tokenDisplayDetails.tokenSymbol || 'T'}
                                            sizeClass="h-6 w-6"
                                        />
                                        {/* Smaller chain icon, absolutely positioned */}
                                        {transaction.tokenDisplayDetails.chainIconUrl && (
                                            <div className="absolute -bottom-1 -right-1">
                                                <DisplayIcon
                                                    iconUrl={transaction.tokenDisplayDetails.chainIconUrl}
                                                    altText={transaction.tokenDisplayDetails.chainName || 'chain'}
                                                    fallbackName={transaction.tokenDisplayDetails.chainName || 'C'}
                                                    sizeClass="h-3.5 w-3.5"
                                                    className="rounded-full border-2 border-white dark:border-grey-4"
                                                />
                                            </div>
                                        )}
                                    </div>
                                    <span>
                                        {transaction.tokenDisplayDetails.tokenSymbol} on{' '}
                                        {transaction.tokenDisplayDetails.chainName}
                                    </span>
                                </div>
                            }
                            hideBottomBorder={!transaction.networkFeeDetails && !transaction.peanutFeeDetails}
                        />
                    )}

                    {transaction.status === 'cancelled' &&
                        transaction.extraDataForDrawer?.originalUserRole === EHistoryUserRole.BOTH &&
                        transaction.cancelledDate && (
                            <>
                                {transaction.cancelledDate && (
                                    <PaymentInfoRow
                                        label="Cancelled"
                                        value={formatDate(transaction.cancelledDate as Date)}
                                        hideBottomBorder={
                                            !transaction.fee && !transaction.memo && !transaction.attachmentUrl
                                        }
                                    />
                                )}
                            </>
                        )}
                    {transaction.fee !== undefined && (
                        <PaymentInfoRow
                            label="Fee"
                            value={feeDisplay}
                            hideBottomBorder={!transaction.memo && !transaction.attachmentUrl}
                        />
                    )}

                    {transaction.status !== 'pending' && (
                        <PaymentInfoRow
                            label="Peanut fee"
                            value={'$ 0'}
                            hideBottomBorder={
                                !transaction.memo && !transaction.attachmentUrl && !transaction.networkFeeDetails
                            }
                        />
                    )}
                    {transaction.memo?.trim() && (
                        <PaymentInfoRow
                            label="Comment"
                            value={transaction.memo}
                            hideBottomBorder={!transaction.attachmentUrl}
                        />
                    )}

                    {transaction.networkFeeDetails && transaction.sourceView === 'status' && (
                        <PaymentInfoRow
                            label="Network fee"
                            value={transaction.networkFeeDetails.amountDisplay}
                            moreInfoText={transaction.networkFeeDetails.moreInfoText}
                            hideBottomBorder={!transaction.attachmentUrl}
                        />
                    )}

                    {transaction.attachmentUrl && (
                        <PaymentInfoRow
                            label="Attachment"
                            value={
                                <Link
                                    href={transaction.attachmentUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-center underline"
                                >
                                    Download
                                    <Icon name="download" className="h-3" />
                                </Link>
                            }
                            hideBottomBorder
                        />
                    )}
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
                        transaction.extraDataForDrawer.originalUserRole === EHistoryUserRole.SENDER &&
                        setIsLoading &&
                        onClose && (
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
                                                        queryKey: [TRANSACTIONS],
                                                    })
                                                    .then(() => {
                                                        setIsLoading(false)
                                                        onClose()
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
                                <div className="flex items-center">
                                    <Icon
                                        name="cancel"
                                        className="mr-0.5 min-w-3 rounded-full border border-black p-0.5"
                                    />
                                </div>
                                <span>Cancel link</span>
                            </Button>
                        )}
                </div>
            )}

            {isPendingSentLink && !shouldShowQrShare && (
                <div className="flex items-center justify-center gap-1.5 text-center text-xs font-semibold text-grey-1">
                    <Icon name="info" size={20} />
                    Use the device where you created it to cancel or re-share this link.
                </div>
            )}

            {isPendingRequester && setIsLoading && onClose && (
                <Button
                    icon="cancel"
                    iconContainerClassName="border border-black w-4 h-4 mr-1 rounded-full"
                    iconClassName="p-1"
                    onClick={() => {
                        setIsLoading(true)
                        chargesApi
                            .cancel(transaction.id)
                            .then(() => {
                                queryClient
                                    .invalidateQueries({
                                        queryKey: [TRANSACTIONS],
                                    })
                                    .then(() => {
                                        setIsLoading(false)
                                        onClose()
                                    })
                            })
                            .catch((error) => {
                                captureException(error)
                                console.error('Error canceling charge:', error)
                                setIsLoading(false)
                            })
                    }}
                    variant={'primary-soft'}
                    shadowSize="4"
                    className="flex w-full items-center gap-1"
                >
                    Cancel request
                </Button>
            )}

            {isPendingRequestee && setIsLoading && onClose && (
                <div className="space-y-2">
                    <Button
                        onClick={() => {
                            window.location.href = transaction.extraDataForDrawer?.link ?? ''
                        }}
                        shadowSize="4"
                        className="flex w-full items-center gap-1"
                    >
                        <Icon name="currency" />
                        Pay
                    </Button>
                    <Button
                        icon="cancel"
                        iconContainerClassName="border border-black w-4 h-4 mr-1 rounded-full"
                        iconClassName="p-1"
                        onClick={() => {
                            setIsLoading(true)
                            chargesApi
                                .cancel(transaction.id)
                                .then(() => {
                                    queryClient
                                        .invalidateQueries({
                                            queryKey: [TRANSACTIONS],
                                        })
                                        .then(() => {
                                            setIsLoading(false)
                                            onClose()
                                        })
                                })
                                .catch((error) => {
                                    captureException(error)
                                    console.error('Error canceling charge:', error)
                                    setIsLoading(false)
                                })
                        }}
                        variant={'primary-soft'}
                        shadowSize="4"
                        className="flex w-full items-center gap-1"
                    >
                        Reject request
                    </Button>
                </div>
            )}

            {shouldShowShareReceipt && transaction.extraDataForDrawer?.link && (
                <ShareButton url={transaction.extraDataForDrawer.link}>Share Receipt</ShareButton>
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
    )
}
