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
import { cancelOnramp } from '@/app/actions/onramp'
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
import CopyToClipboard from '../Global/CopyToClipboard'
import MoreInfo from '../Global/MoreInfo'

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

const getBankAccountLabel = (type: string) => {
    switch (type.toLowerCase()) {
        case 'iban':
            return 'IBAN'
        case 'clabe':
            return 'CLABE'
        default:
            return 'Account number'
    }
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
    const [showBankDetails, setShowBankDetails] = useState(false)

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
        : transaction.currency?.amount
          ? `$ ${formatAmount(Number(transaction.currency.amount))}`
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
                                !transaction.bankAccountDetails &&
                                !transaction.tokenDisplayDetails &&
                                !transaction.cancelledDate &&
                                !transaction.fee &&
                                !transaction.memo &&
                                !transaction.attachmentUrl &&
                                !transaction.extraDataForDrawer?.depositInstructions &&
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

                    {transaction.bankAccountDetails && (
                        <PaymentInfoRow
                            label={getBankAccountLabel(transaction.bankAccountDetails.type)}
                            value={
                                <div className="flex items-center gap-2">
                                    <span>{transaction.bankAccountDetails.identifier.toUpperCase()}</span>
                                    <CopyToClipboard
                                        textToCopy={transaction.bankAccountDetails.identifier.toUpperCase()}
                                        iconSize="4"
                                    />
                                </div>
                            }
                            hideBottomBorder={!transaction.status && !transaction.memo && !transaction.attachmentUrl}
                        />
                    )}
                    {transaction.id && transaction.direction === 'bank_withdraw' && (
                        <PaymentInfoRow
                            label="Transfer ID"
                            value={
                                <div className="flex items-center gap-2">
                                    <span>{transaction.id.toUpperCase()}</span>
                                    <CopyToClipboard textToCopy={transaction.id.toUpperCase()} iconSize="4" />
                                </div>
                            }
                            hideBottomBorder={!transaction.status && !transaction.memo && !transaction.attachmentUrl}
                        />
                    )}

                    {/* Onramp deposit instructions for bridge_onramp transactions */}
                    {transaction.direction === 'bank_deposit' &&
                        transaction.status === 'pending' &&
                        transaction.extraDataForDrawer?.depositInstructions &&
                        transaction.extraDataForDrawer.depositInstructions.bank_name && (
                            <>
                                <PaymentInfoRow
                                    label={
                                        <div className="flex items-center gap-1">
                                            <span>Deposit Message</span>
                                            <MoreInfo text="Make sure you enter this exact message as the transfer concept or description. If it's not included, the deposit can't be processed." />
                                        </div>
                                    }
                                    value={
                                        <div className="flex items-center gap-2">
                                            <span>
                                                {transaction.extraDataForDrawer.depositInstructions.deposit_message}
                                            </span>
                                            <CopyToClipboard
                                                textToCopy={
                                                    transaction.extraDataForDrawer.depositInstructions.deposit_message
                                                }
                                                iconSize="4"
                                            />
                                        </div>
                                    }
                                    hideBottomBorder={false}
                                />

                                {/* Toggle button for bank details */}
                                <div className="border-grey-11 border-b pb-3">
                                    <button
                                        onClick={() => setShowBankDetails(!showBankDetails)}
                                        className="flex w-full items-center justify-between py-3 text-left text-sm font-medium text-black underline transition-colors"
                                    >
                                        <span>{showBankDetails ? 'Hide bank details' : 'See bank details'}</span>
                                        <Icon
                                            name="chevron-up"
                                            className={`h-4 w-4 transition-transform ${!showBankDetails ? 'rotate-180' : ''}`}
                                        />
                                    </button>
                                </div>

                                {/* Collapsible bank details */}
                                {showBankDetails && (
                                    <>
                                        <PaymentInfoRow
                                            label="Bank Name"
                                            value={
                                                <div className="flex items-center gap-2">
                                                    <span>
                                                        {transaction.extraDataForDrawer.depositInstructions.bank_name}
                                                    </span>
                                                    <CopyToClipboard
                                                        textToCopy={
                                                            transaction.extraDataForDrawer.depositInstructions.bank_name
                                                        }
                                                        iconSize="4"
                                                    />
                                                </div>
                                            }
                                            hideBottomBorder={false}
                                        />
                                        <PaymentInfoRow
                                            label="Bank Address"
                                            value={
                                                <div className="flex items-center gap-2">
                                                    <span>
                                                        {
                                                            transaction.extraDataForDrawer.depositInstructions
                                                                .bank_address
                                                        }
                                                    </span>
                                                    <CopyToClipboard
                                                        textToCopy={
                                                            transaction.extraDataForDrawer.depositInstructions
                                                                .bank_address
                                                        }
                                                        iconSize="4"
                                                    />
                                                </div>
                                            }
                                            hideBottomBorder={false}
                                        />

                                        {/* European format (IBAN/BIC) */}
                                        {transaction.extraDataForDrawer.depositInstructions.iban &&
                                        transaction.extraDataForDrawer.depositInstructions.bic ? (
                                            <>
                                                <PaymentInfoRow
                                                    label="IBAN"
                                                    value={
                                                        <div className="flex items-center gap-2">
                                                            <span>
                                                                {
                                                                    transaction.extraDataForDrawer.depositInstructions
                                                                        .iban
                                                                }
                                                            </span>
                                                            <CopyToClipboard
                                                                textToCopy={
                                                                    transaction.extraDataForDrawer.depositInstructions
                                                                        .iban
                                                                }
                                                                iconSize="4"
                                                            />
                                                        </div>
                                                    }
                                                    hideBottomBorder={false}
                                                />
                                                <PaymentInfoRow
                                                    label="BIC"
                                                    value={
                                                        <div className="flex items-center gap-2">
                                                            <span>
                                                                {transaction.extraDataForDrawer.depositInstructions.bic}
                                                            </span>
                                                            <CopyToClipboard
                                                                textToCopy={
                                                                    transaction.extraDataForDrawer.depositInstructions
                                                                        .bic
                                                                }
                                                                iconSize="4"
                                                            />
                                                        </div>
                                                    }
                                                    hideBottomBorder={false}
                                                />
                                                {transaction.extraDataForDrawer.depositInstructions
                                                    .account_holder_name && (
                                                    <PaymentInfoRow
                                                        label="Account Holder Name"
                                                        value={
                                                            <div className="flex items-center gap-2">
                                                                <span>
                                                                    {
                                                                        transaction.extraDataForDrawer
                                                                            .depositInstructions.account_holder_name
                                                                    }
                                                                </span>
                                                                <CopyToClipboard
                                                                    textToCopy={
                                                                        transaction.extraDataForDrawer
                                                                            .depositInstructions.account_holder_name
                                                                    }
                                                                    iconSize="4"
                                                                />
                                                            </div>
                                                        }
                                                        hideBottomBorder={true}
                                                    />
                                                )}
                                            </>
                                        ) : (
                                            /* US format (Account Number/Routing Number) */
                                            <>
                                                <PaymentInfoRow
                                                    label="Account Number"
                                                    value={
                                                        <div className="flex items-center gap-2">
                                                            <span>
                                                                {
                                                                    transaction.extraDataForDrawer.depositInstructions
                                                                        .bank_account_number
                                                                }
                                                            </span>
                                                            <CopyToClipboard
                                                                textToCopy={
                                                                    transaction.extraDataForDrawer.depositInstructions
                                                                        .bank_account_number!
                                                                }
                                                                iconSize="4"
                                                            />
                                                        </div>
                                                    }
                                                    hideBottomBorder={false}
                                                />
                                                <PaymentInfoRow
                                                    label="Routing Number"
                                                    value={
                                                        <div className="flex items-center gap-2">
                                                            <span>
                                                                {
                                                                    transaction.extraDataForDrawer.depositInstructions
                                                                        .bank_routing_number
                                                                }
                                                            </span>
                                                            <CopyToClipboard
                                                                textToCopy={
                                                                    transaction.extraDataForDrawer.depositInstructions
                                                                        .bank_routing_number!
                                                                }
                                                                iconSize="4"
                                                            />
                                                        </div>
                                                    }
                                                    hideBottomBorder={false}
                                                />
                                                {transaction.extraDataForDrawer.depositInstructions
                                                    .bank_beneficiary_name && (
                                                    <PaymentInfoRow
                                                        label="Beneficiary Name"
                                                        value={
                                                            <div className="flex items-center gap-2">
                                                                <span>
                                                                    {
                                                                        transaction.extraDataForDrawer
                                                                            .depositInstructions.bank_beneficiary_name
                                                                    }
                                                                </span>
                                                                <CopyToClipboard
                                                                    textToCopy={
                                                                        transaction.extraDataForDrawer
                                                                            .depositInstructions.bank_beneficiary_name
                                                                    }
                                                                    iconSize="4"
                                                                />
                                                            </div>
                                                        }
                                                        hideBottomBorder={false}
                                                    />
                                                )}
                                                {transaction.extraDataForDrawer.depositInstructions
                                                    .bank_beneficiary_address && (
                                                    <PaymentInfoRow
                                                        label="Beneficiary Address"
                                                        value={
                                                            <div className="flex items-center gap-2">
                                                                <span>
                                                                    {
                                                                        transaction.extraDataForDrawer
                                                                            .depositInstructions
                                                                            .bank_beneficiary_address
                                                                    }
                                                                </span>
                                                                <CopyToClipboard
                                                                    textToCopy={
                                                                        transaction.extraDataForDrawer
                                                                            .depositInstructions
                                                                            .bank_beneficiary_address
                                                                    }
                                                                    iconSize="4"
                                                                />
                                                            </div>
                                                        }
                                                        hideBottomBorder={true}
                                                    />
                                                )}
                                            </>
                                        )}
                                    </>
                                )}
                            </>
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

            {/* Cancel deposit button for bridge_onramp transactions in awaiting_funds state */}
            {transaction.direction === 'bank_deposit' &&
                transaction.status === 'pending' &&
                transaction.extraDataForDrawer?.depositInstructions &&
                setIsLoading &&
                onClose && (
                    <Button
                        onClick={async () => {
                            setIsLoading(true)
                            try {
                                const result = await cancelOnramp(transaction.id)

                                if (result.error) {
                                    throw new Error(result.error)
                                }

                                // Invalidate queries and close drawer
                                queryClient
                                    .invalidateQueries({
                                        queryKey: [TRANSACTIONS],
                                    })
                                    .then(() => {
                                        setIsLoading(false)
                                        onClose()
                                    })
                            } catch (error) {
                                captureException(error)
                                console.error('Error canceling deposit:', error)
                                setIsLoading(false)
                            }
                        }}
                        variant={'primary-soft'}
                        className="flex w-full items-center gap-1"
                        shadowSize="4"
                    >
                        <div className="flex items-center">
                            <Icon name="cancel" className="mr-0.5 min-w-3 rounded-full border border-black p-0.5" />
                        </div>
                        <span>Cancel deposit</span>
                    </Button>
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
