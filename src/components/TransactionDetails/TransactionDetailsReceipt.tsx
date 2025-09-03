import Card from '@/components/Global/Card'
import { PaymentInfoRow } from '@/components/Payment/PaymentInfoRow'
import { TransactionDetails } from '@/components/TransactionDetails/transactionTransformer'
import { TRANSACTIONS } from '@/constants/query.consts'
import { EHistoryEntryType, EHistoryUserRole } from '@/hooks/useTransactionHistory'
import { useWallet } from '@/hooks/wallet/useWallet'
import { useUserStore } from '@/redux/hooks'
import { chargesApi } from '@/services/charges'
import { sendLinksApi } from '@/services/sendLinks'
import { formatAmount, formatDate, getInitialsFromName } from '@/utils'
import { formatIban, printableAddress, shortenAddress, shortenAddressLong } from '@/utils/general.utils'
import { getDisplayCurrencySymbol } from '@/utils/currency'
import { cancelOnramp } from '@/app/actions/onramp'
import { captureException } from '@sentry/nextjs'
import { useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import React, { useMemo, useState, useEffect } from 'react'
import { Button } from '../0_Bruddle'
import DisplayIcon from '../Global/DisplayIcon'
import { Icon } from '../Global/Icons/Icon'
import QRCodeWrapper from '../Global/QRCodeWrapper'
import ShareButton from '../Global/ShareButton'
import { TransactionDetailsHeaderCard } from './TransactionDetailsHeaderCard'
import CopyToClipboard from '../Global/CopyToClipboard'
import MoreInfo from '../Global/MoreInfo'
import CancelSendLinkModal from '../Global/CancelSendLinkModal'
import { twMerge } from 'tailwind-merge'
import { isAddress } from 'viem'
import { getBankAccountLabel, TransactionDetailsRowKey, transactionDetailsRowKeys } from './transaction-details.utils'

export const TransactionDetailsReceipt = ({
    transaction,
    onClose,
    isLoading,
    setIsLoading,
    contentRef,
    transactionAmount,
    className,
    isModalOpen = false,
    setIsModalOpen,
}: {
    transaction: TransactionDetails | null
    onClose?: () => void
    isLoading?: boolean
    setIsLoading?: (isLoading: boolean) => void
    contentRef?: React.RefObject<HTMLDivElement>
    transactionAmount?: string // dollarized amount of the transaction
    className?: HTMLDivElement['className']
    isModalOpen?: boolean
    setIsModalOpen?: (isModalOpen: boolean) => void
}) => {
    // ref for the main content area to calculate dynamic height
    const { user } = useUserStore()
    const queryClient = useQueryClient()
    const { fetchBalance } = useWallet()
    const [showBankDetails, setShowBankDetails] = useState(false)
    const [showCancelLinkModal, setShowCancelLinkModal] = useState(isModalOpen)
    const [tokenData, setTokenData] = useState<{ symbol: string; icon: string }>({
        symbol: '',
        icon: '',
    })
    const [isTokenDataLoading, setIsTokenDataLoading] = useState(true)

    useEffect(() => {
        setIsModalOpen?.(showCancelLinkModal)
    }, [showCancelLinkModal])

    const isGuestBankClaim = useMemo(() => {
        if (!transaction) return false
        return transaction.extraDataForDrawer?.originalType === EHistoryEntryType.BANK_SEND_LINK_CLAIM
    }, [transaction])

    const isPendingBankRequest = useMemo(() => {
        if (!transaction) return false
        return (
            transaction.status === 'pending' &&
            transaction.extraDataForDrawer?.originalType === EHistoryEntryType.REQUEST &&
            transaction.extraDataForDrawer?.fulfillmentType === 'bridge'
        )
    }, [transaction])

    // config to determine which rows are visible in the receipt
    // this helps in managing layout and borders without repeating code
    const rowVisibilityConfig = useMemo((): Record<TransactionDetailsRowKey, boolean> => {
        if (!transaction) {
            // if no transaction, return all false
            return transactionDetailsRowKeys.reduce(
                (acc, key) => {
                    acc[key] = false
                    return acc
                },
                {} as Record<TransactionDetailsRowKey, boolean>
            )
        }

        // if transaction exists, calculate visibility for each row
        return {
            createdAt: !!transaction.createdAt,
            to: transaction.direction === 'claim_external',
            tokenAndNetwork: !!(
                transaction.tokenDisplayDetails &&
                transaction.sourceView === 'history' &&
                // hide token and network for send links in acitvity drawer for sender
                !(
                    transaction.extraDataForDrawer?.originalType === EHistoryEntryType.SEND_LINK &&
                    transaction.extraDataForDrawer?.originalUserRole === EHistoryUserRole.SENDER
                )
            ),
            txId: !!transaction.txHash,
            cancelled: !!(transaction.status === 'cancelled' && transaction.cancelledDate),
            claimed: !!(transaction.status === 'completed' && transaction.claimedAt),
            completed: !!(
                transaction.status === 'completed' &&
                transaction.completedAt &&
                transaction.extraDataForDrawer?.originalType !== EHistoryEntryType.DIRECT_SEND
            ),
            fee: transaction.fee !== undefined,
            exchangeRate: !!(
                transaction.direction === 'bank_deposit' &&
                transaction.status === 'completed' &&
                transaction.currency?.code &&
                transaction.currency.code.toUpperCase() !== 'USD'
            ),
            bankAccountDetails: !!(transaction.bankAccountDetails && transaction.bankAccountDetails.identifier),
            transferId: !!(
                transaction.id &&
                (transaction.direction === 'bank_withdraw' || transaction.direction === 'bank_claim')
            ),
            depositInstructions: !!(
                (transaction.extraDataForDrawer?.originalType === EHistoryEntryType.BRIDGE_ONRAMP ||
                    (isPendingBankRequest &&
                        transaction.extraDataForDrawer?.originalUserRole === EHistoryUserRole.SENDER)) &&
                transaction.status === 'pending' &&
                transaction.extraDataForDrawer?.depositInstructions &&
                transaction.extraDataForDrawer.depositInstructions.bank_name
            ),
            peanutFee: transaction.status !== 'pending',
            comment: !!transaction.memo?.trim(),
            networkFee: !!(transaction.networkFeeDetails && transaction.sourceView === 'status'),
            attachment: !!transaction.attachmentUrl,
        }
    }, [transaction, isPendingBankRequest])

    const visibleRows = useMemo(() => {
        // filter rowkeys to only include visible rows, maintaining the order
        return transactionDetailsRowKeys.filter((key) => rowVisibilityConfig[key])
    }, [rowVisibilityConfig])

    // helper to hide border for the last visible row
    const shouldHideBorder = (rowKey: TransactionDetailsRowKey) => {
        const lastVisibleRow = visibleRows[visibleRows.length - 1]
        return rowKey === lastVisibleRow
    }

    const isPendingRequestee = useMemo(() => {
        if (!transaction) return false
        return (
            transaction.status === 'pending' &&
            transaction.extraDataForDrawer?.originalType === EHistoryEntryType.REQUEST &&
            transaction.extraDataForDrawer?.originalUserRole === EHistoryUserRole.SENDER &&
            !transaction.extraDataForDrawer?.fulfillmentType
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

    useEffect(() => {
        const getTokenDetails = async () => {
            if (!transaction) {
                setIsTokenDataLoading(false)
                return
            }

            if (transaction.tokenDisplayDetails?.tokenIconUrl && transaction.tokenDisplayDetails.tokenSymbol) {
                setTokenData({
                    symbol: transaction.tokenDisplayDetails.tokenSymbol,
                    icon: transaction.tokenDisplayDetails.tokenIconUrl,
                })
                setIsTokenDataLoading(false)
                return
            }

            try {
                const res = await fetch(
                    `https://api.coingecko.com/api/v3/coins/${transaction.tokenDisplayDetails?.chainName}/contract/${transaction.tokenAddress}`
                )
                const tokenDetails = await res.json()
                setTokenData({
                    symbol: tokenDetails.symbol,
                    icon: tokenDetails.image.large,
                })
            } catch (e) {
                console.error(e)
                setTokenData({
                    symbol: '',
                    icon: '',
                })
            } finally {
                setIsTokenDataLoading(false)
            }
        }

        getTokenDetails()
    }, [])

    if (!transaction) return null

    // format data for display
    let amountDisplay = ''

    if (transactionAmount) {
        amountDisplay = transactionAmount.replace(/[+-]/g, '').replace(/\$/, '$ ')
    } else if (transaction.extraDataForDrawer?.rewardData) {
        amountDisplay = transaction.extraDataForDrawer.rewardData.formatAmount(transaction.amount)
    } else if (
        (transaction.direction === 'bank_deposit' || transaction.direction === 'bank_request_fulfillment') &&
        transaction.currency?.code &&
        transaction.currency.code.toUpperCase() !== 'USD'
    ) {
        const isCompleted = transaction.status === 'completed'

        if (isCompleted) {
            // For completed bank_deposit: show USD amount (amount is already in USD)
            amountDisplay = `$ ${formatAmount(transaction.amount as number)}`
        } else {
            // For non-completed bank_deposit: show original currency
            const currencyAmount = transaction.currency?.amount || transaction.amount.toString()
            const currencySymbol = getDisplayCurrencySymbol(transaction.currency.code)
            amountDisplay = `${currencySymbol} ${formatAmount(Number(currencyAmount))}`
        }
    } else {
        // default: use currency amount if provided, otherwise fallback to raw amount - never show token value, only USD
        if (transaction.currency?.amount) {
            amountDisplay = `$ ${formatAmount(Number(transaction.currency.amount))}`
        } else {
            amountDisplay = `$ ${formatAmount(transaction.amount as number)}`
        }
    }
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

    const getLabelText = (transaction: TransactionDetails) => {
        if (transaction.extraDataForDrawer?.originalType === EHistoryEntryType.WITHDRAW) {
            return 'Completed'
        } else if (transaction.extraDataForDrawer?.originalType === EHistoryEntryType.DEPOSIT) {
            return 'Completed'
        } else {
            return transaction.extraDataForDrawer?.originalUserRole === EHistoryUserRole.SENDER ? 'Sent' : 'Received'
        }
    }

    return (
        <div ref={contentRef} className={twMerge('space-y-4', className)}>
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
                haveSentMoneyToUser={transaction.haveSentMoneyToUser}
            />

            {/* details card (date, fee, memo) and more */}
            <Card position={shouldShowQrShare ? 'first' : 'single'} className="px-4 py-0" border={true}>
                <div className="space-y-0">
                    {rowVisibilityConfig.createdAt && (
                        <PaymentInfoRow
                            label={'Created'}
                            value={formatDate(new Date(transaction.createdAt!.toString()))}
                            hideBottomBorder={shouldHideBorder('createdAt')}
                        />
                    )}

                    {rowVisibilityConfig.to && (
                        <PaymentInfoRow
                            label={'To'}
                            value={
                                <div className="flex items-center gap-2">
                                    <span>
                                        {isAddress(transaction.userName)
                                            ? printableAddress(transaction.userName)
                                            : transaction.userName}
                                    </span>
                                    <CopyToClipboard textToCopy={transaction.userName} iconSize="4" />
                                </div>
                            }
                            hideBottomBorder={shouldHideBorder('to')}
                        />
                    )}

                    {rowVisibilityConfig.tokenAndNetwork && transaction.tokenDisplayDetails && (
                        <PaymentInfoRow
                            label="Token and network"
                            value={
                                isTokenDataLoading ? (
                                    <div className="h-6 w-32 animate-pulse rounded bg-gray-200" />
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <div className="relative flex h-6 w-6 min-w-[24px] items-center justify-center">
                                            {/* Main token icon */}
                                            <DisplayIcon
                                                iconUrl={tokenData.icon}
                                                altText={tokenData.symbol || 'token'}
                                                fallbackName={tokenData.symbol || 'T'}
                                                sizeClass="h-6 w-6"
                                            />
                                            {/* Smaller chain icon, absolutely positioned */}
                                            {transaction.tokenDisplayDetails.chainIconUrl && (
                                                <div className="absolute -bottom-1 -right-1">
                                                    <DisplayIcon
                                                        iconUrl={transaction.tokenDisplayDetails.chainIconUrl}
                                                        altText={transaction.tokenDisplayDetails.chainName || 'chain'}
                                                        fallbackName={transaction.tokenDisplayDetails.chainName || 'C'}
                                                        sizeClass="h-3.5 w-3.5 text-[7px]"
                                                        className="rounded-full border-2 border-white dark:border-grey-4"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                        <span>
                                            {tokenData.symbol.toUpperCase()} on{' '}
                                            {transaction.tokenDisplayDetails.chainName}
                                        </span>
                                    </div>
                                )
                            }
                            hideBottomBorder={shouldHideBorder('tokenAndNetwork')}
                        />
                    )}

                    {rowVisibilityConfig.txId && transaction.txHash && (
                        <PaymentInfoRow
                            label="TX ID"
                            value={
                                transaction.explorerUrl ? (
                                    <Link
                                        href={transaction.explorerUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-2 hover:underline"
                                    >
                                        <span>{shortenAddressLong(transaction.txHash)}</span>
                                        <Icon name="external-link" size={12} />
                                    </Link>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <span>{shortenAddressLong(transaction.txHash)}</span>
                                        <CopyToClipboard textToCopy={transaction.txHash} iconSize="4" />
                                    </div>
                                )
                            }
                            hideBottomBorder={shouldHideBorder('txId')}
                        />
                    )}

                    {rowVisibilityConfig.cancelled && (
                        <>
                            {transaction.cancelledDate && (
                                <PaymentInfoRow
                                    label="Cancelled"
                                    value={formatDate(new Date(transaction.cancelledDate))}
                                    hideBottomBorder={shouldHideBorder('cancelled')}
                                />
                            )}
                        </>
                    )}

                    {rowVisibilityConfig.claimed && (
                        <>
                            {transaction.claimedAt && (
                                <PaymentInfoRow
                                    label="Claimed"
                                    value={formatDate(new Date(transaction.claimedAt))}
                                    hideBottomBorder={shouldHideBorder('claimed')}
                                />
                            )}
                        </>
                    )}

                    {rowVisibilityConfig.completed && (
                        <>
                            <PaymentInfoRow
                                label={getLabelText(transaction)}
                                value={formatDate(new Date(transaction.completedAt!))}
                                hideBottomBorder={shouldHideBorder('completed')}
                            />
                        </>
                    )}

                    {rowVisibilityConfig.fee && (
                        <PaymentInfoRow label="Fee" value={feeDisplay} hideBottomBorder={shouldHideBorder('fee')} />
                    )}

                    {/* Exchange rate and original currency for completed bank_deposit transactions */}
                    {rowVisibilityConfig.exchangeRate && (
                        <>
                            <PaymentInfoRow
                                label="Original amount"
                                value={(() => {
                                    const currencyAmount = transaction.currency?.amount || transaction.amount.toString()
                                    const currencySymbol = getDisplayCurrencySymbol(transaction.currency!.code)
                                    return `${currencySymbol} ${formatAmount(Number(currencyAmount))}`
                                })()}
                                hideBottomBorder={false}
                            />
                            {transaction.extraDataForDrawer?.receipt?.exchange_rate && (
                                <PaymentInfoRow
                                    label="Exchange rate"
                                    value={`1 ${transaction.currency!.code?.toUpperCase()} = $${formatAmount(Number(transaction.extraDataForDrawer.receipt.exchange_rate))}`}
                                    hideBottomBorder={shouldHideBorder('exchangeRate')}
                                />
                            )}
                        </>
                    )}

                    {rowVisibilityConfig.bankAccountDetails && transaction.bankAccountDetails && (
                        <PaymentInfoRow
                            label={getBankAccountLabel(transaction.bankAccountDetails!.type)}
                            value={
                                <div className="flex items-center gap-2">
                                    <span>
                                        {isGuestBankClaim
                                            ? transaction.bankAccountDetails.identifier
                                            : formatIban(transaction.bankAccountDetails.identifier)}
                                    </span>
                                    {!isGuestBankClaim && (
                                        <CopyToClipboard
                                            textToCopy={formatIban(transaction.bankAccountDetails.identifier)}
                                            iconSize="4"
                                        />
                                    )}
                                </div>
                            }
                            hideBottomBorder={shouldHideBorder('bankAccountDetails')}
                        />
                    )}
                    {rowVisibilityConfig.transferId && (
                        <PaymentInfoRow
                            label="Transfer ID"
                            value={
                                <div className="flex items-center gap-2">
                                    <span>{shortenAddress(transaction.id.toUpperCase(), 20)}</span>
                                    <CopyToClipboard textToCopy={transaction.id.toUpperCase()} iconSize="4" />
                                </div>
                            }
                            hideBottomBorder={shouldHideBorder('transferId')}
                        />
                    )}

                    {/* Onramp deposit instructions for bridge_onramp transactions */}
                    {rowVisibilityConfig.depositInstructions && transaction.extraDataForDrawer?.depositInstructions && (
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
                                hideBottomBorder={shouldHideBorder('depositInstructions')}
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
                                                    {transaction.extraDataForDrawer.depositInstructions.bank_address}
                                                </span>
                                                <CopyToClipboard
                                                    textToCopy={
                                                        transaction.extraDataForDrawer.depositInstructions.bank_address
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
                                                            {formatIban(
                                                                transaction.extraDataForDrawer.depositInstructions.iban
                                                            )}
                                                        </span>
                                                        <CopyToClipboard
                                                            textToCopy={formatIban(
                                                                transaction.extraDataForDrawer.depositInstructions.iban
                                                            )}
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
                                                                transaction.extraDataForDrawer.depositInstructions.bic
                                                            }
                                                            iconSize="4"
                                                        />
                                                    </div>
                                                }
                                                hideBottomBorder={false}
                                            />
                                            {transaction.extraDataForDrawer.depositInstructions.account_holder_name && (
                                                <PaymentInfoRow
                                                    label="Account Holder Name"
                                                    value={
                                                        <div className="flex items-center gap-2">
                                                            <span>
                                                                {
                                                                    transaction.extraDataForDrawer.depositInstructions
                                                                        .account_holder_name
                                                                }
                                                            </span>
                                                            <CopyToClipboard
                                                                textToCopy={
                                                                    transaction.extraDataForDrawer.depositInstructions
                                                                        .account_holder_name
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
                                                                    transaction.extraDataForDrawer.depositInstructions
                                                                        .bank_beneficiary_name
                                                                }
                                                            </span>
                                                            <CopyToClipboard
                                                                textToCopy={
                                                                    transaction.extraDataForDrawer.depositInstructions
                                                                        .bank_beneficiary_name
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
                                                                    transaction.extraDataForDrawer.depositInstructions
                                                                        .bank_beneficiary_address
                                                                }
                                                            </span>
                                                            <CopyToClipboard
                                                                textToCopy={
                                                                    transaction.extraDataForDrawer.depositInstructions
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

                    {rowVisibilityConfig.peanutFee && (
                        <PaymentInfoRow
                            label="Peanut fee"
                            value={'$ 0'}
                            hideBottomBorder={shouldHideBorder('peanutFee')}
                        />
                    )}
                    {rowVisibilityConfig.comment && (
                        <PaymentInfoRow
                            label="Comment"
                            value={transaction.memo}
                            hideBottomBorder={shouldHideBorder('comment')}
                        />
                    )}

                    {rowVisibilityConfig.networkFee && (
                        <PaymentInfoRow
                            label="Network fee"
                            value={transaction.networkFeeDetails!.amountDisplay}
                            moreInfoText={transaction.networkFeeDetails!.moreInfoText}
                            hideBottomBorder={shouldHideBorder('networkFee')}
                        />
                    )}

                    {rowVisibilityConfig.attachment && transaction.attachmentUrl && (
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
                <div className="space-y-2 pr-1">
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
                                disabled={isLoading}
                                onClick={() => setShowCancelLinkModal(true)}
                                loading={isLoading}
                                variant={'primary-soft'}
                                className="flex w-full items-center gap-1"
                                shadowSize="4"
                            >
                                <div className="flex items-center">
                                    {!isLoading && (
                                        <Icon
                                            name="cancel"
                                            className="mr-0.5 min-w-3 rounded-full border border-black p-0.5"
                                        />
                                    )}
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
                <div className="pr-1">
                    <Button
                        icon="cancel"
                        iconContainerClassName="border border-black w-4 h-4 mr-1 rounded-full"
                        iconClassName="p-1"
                        loading={isLoading}
                        disabled={isLoading}
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
                </div>
            )}

            {isPendingRequestee && setIsLoading && onClose && (
                <div className="space-y-2 pr-1">
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
                        disabled={isLoading}
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
                <div className="pr-1">
                    <ShareButton url={transaction.extraDataForDrawer.link}>Share Receipt</ShareButton>
                </div>
            )}

            {/* Cancel deposit button for bridge_onramp transactions in awaiting_funds state */}
            {transaction.direction === 'bank_deposit' &&
                transaction.extraDataForDrawer?.originalType !== EHistoryEntryType.REQUEST &&
                transaction.status === 'pending' &&
                transaction.extraDataForDrawer?.depositInstructions &&
                setIsLoading &&
                onClose && (
                    <Button
                        disabled={isLoading}
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

            {isPendingBankRequest &&
                transaction.extraDataForDrawer?.originalUserRole === EHistoryUserRole.SENDER &&
                setIsLoading &&
                onClose && (
                    <div className="pr-1">
                        <Button
                            disabled={isLoading}
                            onClick={async () => {
                                setIsLoading(true)
                                try {
                                    // first cancel the onramp
                                    await cancelOnramp(transaction.extraDataForDrawer?.bridgeTransferId!)
                                    // then cancel the charge
                                    await chargesApi.cancel(transaction.id)

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
                            <span>Cancel Request</span>
                        </Button>
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

            {/* Cancel Link Modal  */}

            {setIsLoading && onClose && (
                <CancelSendLinkModal
                    showCancelLinkModal={showCancelLinkModal}
                    setshowCancelLinkModal={setShowCancelLinkModal}
                    amount={amountDisplay}
                    onClick={() => {
                        setIsLoading(true)
                        setShowCancelLinkModal(false)
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
                />
            )}
        </div>
    )
}
