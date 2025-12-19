'use client'
/**
 * @todo This file needs significant DRY (Don't Repeat Yourself) refactoring and consolidation
 * - Multiple repeated UI patterns and logic that could be extracted into reusable components
 * - Complex conditional rendering that could be simplified
 * - Duplicated status/type checking logic that could be centralized
 * - Large component that could be split into smaller focused components
 */

import Card, { getCardPosition } from '@/components/Global/Card'
import { PaymentInfoRow } from '@/components/Payment/PaymentInfoRow'
import { type TransactionDetails } from '@/components/TransactionDetails/transactionTransformer'
import { TRANSACTIONS } from '@/constants/query.consts'
import { EHistoryEntryType, EHistoryUserRole } from '@/hooks/useTransactionHistory'
import { useWallet } from '@/hooks/wallet/useWallet'
import { useUserStore } from '@/redux/hooks'
import { chargesApi } from '@/services/charges'
import useClaimLink from '@/components/Claim/useClaimLink'
import { formatAmount, formatDate, isStableCoin, formatCurrency } from '@/utils/general.utils'
import { getAvatarUrl } from '@/utils/history.utils'
import {
    formatIban,
    getContributorsFromCharge,
    printableAddress,
    shortenAddress,
    shortenStringLong,
    slugify,
} from '@/utils/general.utils'
import { cancelOnramp } from '@/app/actions/onramp'
import { captureException } from '@sentry/nextjs'
import { useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import Image from 'next/image'
import React, { useMemo, useState, useEffect } from 'react'
import { Button } from '@/components/0_Bruddle/Button'
import DisplayIcon from '../Global/DisplayIcon'
import { Icon } from '../Global/Icons/Icon'
import { PerkIcon } from './PerkIcon'
import { STAR_STRAIGHT_ICON } from '@/assets/icons'
import QRCodeWrapper from '../Global/QRCodeWrapper'
import ShareButton from '../Global/ShareButton'
import { TransactionDetailsHeaderCard } from './TransactionDetailsHeaderCard'
import CopyToClipboard from '../Global/CopyToClipboard'
import MoreInfo from '../Global/MoreInfo'
import CancelSendLinkModal from '../Global/CancelSendLinkModal'
import { twMerge } from 'tailwind-merge'
import { isAddress } from 'viem'
import {
    getBankAccountLabel,
    type TransactionDetailsRowKey,
    transactionDetailsRowKeys,
} from './transaction-details.utils'
import { useSupportModalContext } from '@/context/SupportModalContext'
import { useRouter } from 'next/navigation'
import { countryData } from '@/components/AddMoney/consts'
import { useToast } from '@/components/0_Bruddle/Toast'
import {
    MANTECA_COUNTRIES_CONFIG,
    MANTECA_ARG_DEPOSIT_CUIT,
    MANTECA_ARG_DEPOSIT_NAME,
} from '@/constants/manteca.consts'
import { mantecaApi } from '@/services/manteca'
import { getReceiptUrl } from '@/utils/history.utils'
import { PEANUT_WALLET_CHAIN, PEANUT_WALLET_TOKEN_SYMBOL } from '@/constants/zerodev.consts'
import ContributorCard from '../Global/Contributors/ContributorCard'
import { requestsApi } from '@/services/requests'
import { PasskeyDocsLink } from '../Setup/Views/SignTestTransaction'

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
    avatarUrl,
    isPublic = false,
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
    avatarUrl?: string
    isPublic?: boolean
}) => {
    // ref for the main content area to calculate dynamic height
    const { user } = useUserStore()
    const queryClient = useQueryClient()
    const { fetchBalance } = useWallet()
    const { cancelLinkAndClaim, pollForClaimConfirmation } = useClaimLink()
    const [showBankDetails, setShowBankDetails] = useState(false)
    const [showCancelLinkModal, setShowCancelLinkModal] = useState(false)
    const [tokenData, setTokenData] = useState<{ symbol: string; icon: string } | null>(null)
    const [isTokenDataLoading, setIsTokenDataLoading] = useState(true)
    const { setIsSupportModalOpen } = useSupportModalContext()
    const toast = useToast()
    const router = useRouter()
    const [cancelLinkText, setCancelLinkText] = useState<'Cancelling' | 'Cancelled' | 'Cancel link'>('Cancel link')

    // Sync modal state to parent if callback is provided
    useEffect(() => {
        setIsModalOpen?.(showCancelLinkModal)
    }, [showCancelLinkModal, setIsModalOpen])

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

    // check if token is usdc on arbitrum to hide token/network section
    const isPeanutWalletToken = useMemo(() => {
        if (!transaction) return false
        const tokenSymbol = transaction.tokenSymbol?.toUpperCase()
        const chainName = transaction.tokenDisplayDetails?.chainName?.toLowerCase()
        return tokenSymbol === PEANUT_WALLET_TOKEN_SYMBOL && chainName === PEANUT_WALLET_CHAIN.name.toLowerCase()
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
                !isPeanutWalletToken &&
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
            refunded: transaction.status === 'refunded',
            fee: transaction.fee !== undefined,
            exchangeRate: !!(
                (transaction.direction === 'bank_deposit' ||
                    transaction.direction === 'qr_payment' ||
                    transaction.direction === 'bank_withdraw') &&
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
            peanutFee: false, // Perk fee logic removed - perks now show as separate transactions
            points: !!(transaction.points && transaction.points > 0),
            comment: !!transaction.memo?.trim(),
            networkFee: !!(transaction.networkFeeDetails && transaction.sourceView === 'status'),
            attachment: !!transaction.attachmentUrl,
            mantecaDepositInfo:
                !isPublic &&
                transaction.extraDataForDrawer?.originalType === EHistoryEntryType.MANTECA_ONRAMP &&
                transaction.status === 'pending',
            closed: !!(transaction.status === 'closed' && transaction.cancelledDate),
        }
    }, [transaction, isPendingBankRequest])

    const country = useMemo(() => {
        if (!transaction?.currency?.code) return undefined
        return countryData.find((c) => c.currency === transaction.currency?.code)
    }, [transaction?.currency?.code])

    const visibleRows = useMemo(() => {
        // filter rowkeys to only include visible rows, maintaining the order
        return transactionDetailsRowKeys.filter((key) => rowVisibilityConfig[key])
    }, [rowVisibilityConfig])

    // helper to hide border for the last visible row
    const shouldHideBorder = (rowKey: TransactionDetailsRowKey) => {
        const lastVisibleRow = visibleRows[visibleRows.length - 1]
        return rowKey === lastVisibleRow
    }

    // reusable helper to get the last visible row in a specific group
    const getLastVisibleInGroup = (groupKeys: TransactionDetailsRowKey[]) => {
        const visibleInGroup = groupKeys.filter((key) => rowVisibilityConfig[key])
        return visibleInGroup[visibleInGroup.length - 1]
    }

    // define row groups
    const rowGroups = useMemo(
        () => ({
            dateRows: ['createdAt', 'cancelled', 'claimed', 'completed', 'closed'] as TransactionDetailsRowKey[],
            txnDetails: ['tokenAndNetwork', 'txId'] as TransactionDetailsRowKey[],
            fees: ['networkFee', 'peanutFee'] as TransactionDetailsRowKey[],
        }),
        []
    )

    // get last visible row for each group
    const lastVisibleInGroups = useMemo(
        () => ({
            dateRows: getLastVisibleInGroup(rowGroups.dateRows),
            txnDetails: getLastVisibleInGroup(rowGroups.txnDetails),
            fees: getLastVisibleInGroup(rowGroups.fees),
        }),
        [rowVisibilityConfig]
    )

    // @dev TODO: Enable grouped borders when tackling receipt changes
    // reusable helper to check if border should be hidden for a row in a specific group
    const shouldHideGroupBorder = (rowKey: TransactionDetailsRowKey, groupName: keyof typeof rowGroups) => {
        const isLastInGroup = rowKey === lastVisibleInGroups[groupName]
        const isGlobalLast = shouldHideBorder(rowKey)

        // if it's the last in its group, show border UNLESS it's also the global last
        if (isLastInGroup) {
            return isGlobalLast
        }

        // if not last in group, always hide border
        return true
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
        if (isPublic) return false
        if (!transaction || isPendingSentLink || isPendingRequester || isPendingRequestee) return false
        if (transaction?.txHash && transaction.direction !== 'receive' && transaction.direction !== 'request_sent')
            return true
        if (
            [
                EHistoryEntryType.MANTECA_QR_PAYMENT,
                EHistoryEntryType.SIMPLEFI_QR_PAYMENT,
                EHistoryEntryType.MANTECA_OFFRAMP,
                EHistoryEntryType.MANTECA_ONRAMP,
            ].includes(transaction.extraDataForDrawer!.originalType)
        )
            return true
        return false
    }, [transaction, isPendingSentLink, isPendingRequester, isPendingRequestee])

    const isQRPayment =
        transaction &&
        [EHistoryEntryType.MANTECA_QR_PAYMENT, EHistoryEntryType.SIMPLEFI_QR_PAYMENT].includes(
            transaction.extraDataForDrawer!.originalType
        )

    const requestPotContributors = useMemo(() => {
        if (!transaction || !transaction.requestPotPayments) return []
        return getContributorsFromCharge(transaction.requestPotPayments)
    }, [transaction])

    const formattedTotalAmountCollected = formatCurrency(transaction?.totalAmountCollected?.toString() ?? '0', 2, 0)

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
                const chainName = slugify(transaction.tokenDisplayDetails?.chainName ?? '')
                const res = await fetch(
                    `https://api.coingecko.com/api/v3/coins/${chainName}/contract/${transaction.tokenAddress}`
                )

                if (!res.ok) {
                    throw new Error(`CoinGecko API error: ${res.status} ${res.statusText}`)
                }

                const tokenDetails = await res.json()
                setTokenData({
                    symbol: tokenDetails.symbol,
                    icon: tokenDetails.image.large,
                })
            } catch (e) {
                console.error('Failed to fetch token details from CoinGecko:', e)
                setTokenData(null)
            } finally {
                setIsTokenDataLoading(false)
            }
        }

        getTokenDetails()
    }, [])

    const convertedAmount = useMemo(() => {
        if (!transaction) return null
        if (!transaction?.extraDataForDrawer?.receipt?.exchange_rate) {
            return null
        }
        return `${transaction.currency!.code} ${formatCurrency(transaction.currency!.amount)}`
    }, [transaction])

    if (!transaction) return null

    let usdAmount: number | bigint = 0

    if (transactionAmount) {
        // if transactionAmount is provided as a string, parse it
        const parsed = parseFloat(transactionAmount.replace(/[\+\-\$,]/g, ''))
        usdAmount = isNaN(parsed) ? 0 : parsed
    } else if (transaction.amount !== undefined && transaction.amount !== null) {
        // fallback to transaction.amount
        usdAmount = transaction.amount
    } else if (transaction.currency?.amount) {
        // last fallback to currency amount
        const parsed = parseFloat(String(transaction.currency.amount))
        usdAmount = isNaN(parsed) ? 0 : parsed
    }

    // ensure we have a valid number for display
    const numericAmount = typeof usdAmount === 'bigint' ? Number(usdAmount) : usdAmount
    const safeAmount = isNaN(numericAmount) || numericAmount === null || numericAmount === undefined ? 0 : numericAmount
    let amountDisplay = `$${formatCurrency(Math.abs(safeAmount).toString())}`

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

    if (transaction.isRequestPotLink && Number(transaction.amount) > 0) {
        amountDisplay = `$${formatCurrency(transaction.amount.toString())}`
    } else if (transaction.isRequestPotLink && Number(transaction.amount) === 0) {
        amountDisplay = `$${formattedTotalAmountCollected} collected`
    }

    // Show profile button only if txn is completed, not to/by a guest user and its a send/request/receive txn
    const isAvatarClickable =
        !!transaction &&
        !transaction.extraDataForDrawer?.isLinkTransaction &&
        !!transaction.userName &&
        !isAddress(transaction.userName) &&
        (transaction.extraDataForDrawer?.transactionCardType === 'send' ||
            transaction.extraDataForDrawer?.transactionCardType === 'request' ||
            transaction.extraDataForDrawer?.transactionCardType === 'receive')

    const closeRequestLink = async () => {
        if (isPendingRequester && setIsLoading && onClose) {
            setIsLoading(true)
            try {
                if (transaction.isRequestPotLink) {
                    await requestsApi.close(transaction.id)
                } else {
                    await chargesApi.cancel(transaction.id)
                }
                await queryClient.invalidateQueries({
                    queryKey: [TRANSACTIONS],
                })
                setIsLoading(false)
                onClose()
            } catch (error) {
                captureException(error)
                console.error('Error canceling charge:', error)
                setIsLoading(false)
            }
        }
    }
    // Special rendering for PERK_REWARD type
    const isPerkReward = transaction.extraDataForDrawer?.originalType === EHistoryEntryType.PERK_REWARD
    const perkRewardData = transaction.extraDataForDrawer?.perkReward

    if (isPerkReward && perkRewardData) {
        return (
            <div ref={contentRef} className={twMerge('space-y-4', className)}>
                {/* Perk Reward Header - Top section with logo, amount, and status */}
                <Card position="single" className="px-4 py-6">
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                            <PerkIcon size="medium" />
                            <div className="flex flex-col">
                                <h2 className="text-lg font-semibold text-gray-900">Peanut Perk</h2>
                                <p className="text-2xl font-bold text-gray-900">{amountDisplay}</p>
                            </div>
                        </div>
                        <div className="flex-shrink-0">
                            {transaction.status === 'completed' ? (
                                <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
                                    Completed
                                </span>
                            ) : transaction.status === 'pending' || transaction.status === 'processing' ? (
                                <span className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-medium text-yellow-700">
                                    Processing
                                </span>
                            ) : (
                                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                                    {transaction.status}
                                </span>
                            )}
                        </div>
                    </div>
                    <p className="mt-3 text-sm text-gray-600">
                        Earn points, climb tiers, and unlock even better perks.
                    </p>
                </Card>

                {/* Perk Details - Middle section with date, reason, and link */}
                <Card position="single" className="px-4 py-0">
                    <PaymentInfoRow
                        label="Received"
                        value={formatDate(new Date(transaction.date))}
                        hideBottomBorder={false}
                    />
                    <PaymentInfoRow
                        label="Reason"
                        value={perkRewardData.reason}
                        // hideBottomBorder={!perkRewardData.originatingTxId}
                        hideBottomBorder={true}
                    />
                    {/* 
                    
                    {perkRewardData.originatingTxId && (
                        <PaymentInfoRow
                            label="Originating payment"
                            value={
                                <button
                                    className="flex items-center gap-1 text-sm font-medium text-primary-1 hover:underline"
                                    onClick={() => {
                                        // Close current drawer so user can find the transaction in history
                                        if (onClose) {
                                            onClose()
                                        }
                                        // Navigate to home where they can see both transactions
                                        router.push('/home')
                                    }}
                                >
                                    <span>View in history</span>
                                    <Icon name="arrow-up-right" size={12} />
                                </button>
                            }
                            hideBottomBorder={true}
                        />
                    )} */}
                </Card>

                {/* Support link section */}
                <button
                    onClick={() => setIsSupportModalOpen(true)}
                    className="flex w-full items-center justify-center gap-2 text-sm font-medium text-grey-1 underline transition-colors hover:text-black"
                >
                    <Icon name="peanut-support" size={16} className="text-grey-1" />
                    Issues with this transaction?
                </button>
            </div>
        )
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
                initials={transaction.initials}
                status={transaction.status}
                isVerified={transaction.isVerified}
                isLinkTransaction={transaction.extraDataForDrawer?.isLinkTransaction}
                transactionType={transaction.extraDataForDrawer?.transactionCardType}
                avatarUrl={avatarUrl ?? getAvatarUrl(transaction)}
                haveSentMoneyToUser={transaction.haveSentMoneyToUser}
                isAvatarClickable={isAvatarClickable}
                showProgessBar={transaction.isRequestPotLink}
                goal={Number(transaction.amount)}
                progress={Number(formattedTotalAmountCollected)}
                isRequestPotTransaction={transaction.isRequestPotLink}
                isTransactionClosed={transaction.status === 'closed'}
                convertedAmount={convertedAmount ?? undefined}
                showFullName={transaction.showFullName}
                fullName={transaction.fullName}
            />

            {/* Perk eligibility banner */}
            {transaction.extraDataForDrawer?.perk?.claimed && transaction.status !== 'pending' && (
                <Card position="single" className="px-4 py-4">
                    <div className="flex items-center gap-3">
                        <PerkIcon size="small" />
                        <div className="flex flex-col gap-1">
                            <span className="font-semibold text-gray-900">Eligible for a Peanut Perk!</span>
                            <span className="text-sm text-gray-600">
                                {(() => {
                                    const perk = transaction.extraDataForDrawer.perk
                                    const percentage = perk.discountPercentage
                                    const amount = perk.amountSponsored
                                    const isCapped = perk.isCapped
                                    const campaignCap = perk.campaignCapUsd

                                    // If user hit their campaign cap, show special message
                                    if (isCapped && campaignCap) {
                                        if (amount !== undefined && amount !== null) {
                                            return `$${amount.toFixed(2)} cashback — campaign limit reached! 🎉`
                                        }
                                        return `Campaign limit reached! 🎉`
                                    }

                                    // For non-capped messages, use amountStr
                                    const amountStr =
                                        amount !== undefined && amount !== null ? `$${amount.toFixed(2)}` : ''

                                    if (percentage === 100) {
                                        return `You received a full refund${amount ? ` (${amountStr})` : ''} as a Peanut Perk.`
                                    } else if (percentage > 100) {
                                        return `You received back${amount ? ` (${amountStr})` : ''} — that's more than you paid!`
                                    } else {
                                        return `You received a Peanut Perk! ${amount ? ` ${amountStr}` : ''} cashback.`
                                    }
                                })()}
                            </span>
                        </div>
                    </div>
                </Card>
            )}

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

                    {rowVisibilityConfig.cancelled && (
                        <PaymentInfoRow
                            label="Cancelled"
                            value={formatDate(new Date(transaction.cancelledDate!))}
                            hideBottomBorder={shouldHideBorder('cancelled')}
                        />
                    )}

                    {rowVisibilityConfig.claimed && (
                        <PaymentInfoRow
                            label="Claimed"
                            value={formatDate(new Date(transaction.claimedAt!))}
                            hideBottomBorder={shouldHideBorder('claimed')}
                        />
                    )}

                    {rowVisibilityConfig.completed && (
                        <PaymentInfoRow
                            label={getLabelText(transaction)}
                            value={formatDate(new Date(transaction.completedAt!))}
                            hideBottomBorder={shouldHideBorder('completed')}
                        />
                    )}

                    {rowVisibilityConfig.refunded && (
                        <PaymentInfoRow
                            label="Refunded"
                            value={formatDate(new Date(transaction.date))}
                            hideBottomBorder={shouldHideBorder('refunded')}
                        />
                    )}

                    {rowVisibilityConfig.closed && (
                        <>
                            {transaction.cancelledDate && (
                                <PaymentInfoRow
                                    label="Closed at"
                                    value={formatDate(new Date(transaction.cancelledDate))}
                                    hideBottomBorder={shouldHideBorder('closed')}
                                />
                            )}
                        </>
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

                    {rowVisibilityConfig.tokenAndNetwork &&
                        transaction.tokenDisplayDetails &&
                        tokenData?.icon &&
                        tokenData?.symbol && (
                            <>
                                {!isStableCoin(transaction.tokenSymbol ?? 'USDC') && (
                                    <PaymentInfoRow label="Token amount" value={transaction.amount} />
                                )}
                                {!isPeanutWalletToken && (
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
                                                                    iconUrl={
                                                                        transaction.tokenDisplayDetails.chainIconUrl
                                                                    }
                                                                    altText={
                                                                        transaction.tokenDisplayDetails.chainName ||
                                                                        'chain'
                                                                    }
                                                                    fallbackName={
                                                                        transaction.tokenDisplayDetails.chainName || 'C'
                                                                    }
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
                            </>
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
                                        <span>{shortenStringLong(transaction.txHash)}</span>
                                        <Icon name="external-link" size={12} />
                                    </Link>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <span>{shortenStringLong(transaction.txHash)}</span>
                                        <CopyToClipboard textToCopy={transaction.txHash} iconSize="4" />
                                    </div>
                                )
                            }
                            hideBottomBorder={shouldHideBorder('txId')}
                        />
                    )}

                    {rowVisibilityConfig.fee && (
                        <PaymentInfoRow label="Fee" value={feeDisplay} hideBottomBorder={shouldHideBorder('fee')} />
                    )}

                    {rowVisibilityConfig.mantecaDepositInfo && (
                        <>
                            {transaction.extraDataForDrawer?.receipt?.depositDetails?.depositAddress && (
                                <PaymentInfoRow
                                    label={
                                        country
                                            ? (MANTECA_COUNTRIES_CONFIG[country.id]?.depositAddressLabel ??
                                              'Deposit Address')
                                            : 'Deposit Address'
                                    }
                                    value={transaction.extraDataForDrawer.receipt.depositDetails.depositAddress}
                                    allowCopy
                                />
                            )}

                            {transaction.extraDataForDrawer?.receipt?.depositDetails?.depositAlias && (
                                <PaymentInfoRow
                                    label="Alias"
                                    value={transaction.extraDataForDrawer.receipt.depositDetails.depositAlias}
                                    allowCopy
                                />
                            )}
                            {country?.id === 'AR' && (
                                <>
                                    <PaymentInfoRow label="Razón Social" value={MANTECA_ARG_DEPOSIT_NAME} />
                                    <PaymentInfoRow label="CUIT" value={MANTECA_ARG_DEPOSIT_CUIT} />
                                </>
                            )}
                        </>
                    )}

                    {/* Exchange rate and original currency for completed bank_deposit transactions */}
                    {rowVisibilityConfig.exchangeRate && (
                        <>
                            {/* TODO: stop using snake_case!!!!! */}
                            {transaction.extraDataForDrawer?.receipt?.exchange_rate && (
                                <PaymentInfoRow
                                    label="Exchange rate"
                                    value={`1 USD = ${transaction.currency!.code?.toUpperCase()} ${formatCurrency(transaction.extraDataForDrawer.receipt.exchange_rate)}`}
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
                                hideBottomBorder={false} // Always show the border for the deposit message
                            />

                            {/* Toggle button for bank details */}
                            <div className="border-grey-11 border-b pb-3">
                                <button
                                    onClick={() => setShowBankDetails(!showBankDetails)}
                                    className="flex w-full items-center justify-between py-3 text-left text-sm font-normal text-black underline transition-colors"
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
                                        hideBottomBorder={true}
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
                                                hideBottomBorder={true}
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
                                                    hideBottomBorder={true}
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

                    {rowVisibilityConfig.points && transaction.points && (
                        <PaymentInfoRow
                            label="Points earned"
                            value={
                                <div className="flex items-center gap-2">
                                    <Image src={STAR_STRAIGHT_ICON} alt="star" width={16} height={16} />
                                    <span>{transaction.points}</span>
                                </div>
                            }
                            hideBottomBorder={shouldHideBorder('points')}
                            onClick={() => router.push('/points')}
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

                    {rowVisibilityConfig.peanutFee && (
                        <PaymentInfoRow
                            label="Peanut fee"
                            value={'Sponsored by Peanut!'}
                            hideBottomBorder={shouldHideBorder('peanutFee')}
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
                                disabled={isLoading || cancelLinkText === 'Cancelled'}
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
                                <span>{cancelLinkText}</span>
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
                        onClick={closeRequestLink}
                        variant={'primary-soft'}
                        shadowSize="4"
                        className="flex w-full items-center gap-1"
                    >
                        {transaction.totalAmountCollected > 0 ? 'Close request' : 'Cancel request'}
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

            {isQRPayment && (
                <Button
                    onClick={() => {
                        router.push(`/request?amount=${transaction.amount}&merchant=${transaction.userName}`)
                    }}
                    icon="split"
                    shadowSize="4"
                >
                    Split this bill
                </Button>
            )}

            {shouldShowShareReceipt && !!getReceiptUrl(transaction) && (
                <div className="pr-1">
                    <ShareButton variant={isQRPayment ? 'primary-soft' : 'purple'} url={getReceiptUrl(transaction)!}>
                        Share Receipt
                    </ShareButton>
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
            {transaction.extraDataForDrawer?.originalType === EHistoryEntryType.MANTECA_ONRAMP &&
                transaction.status === 'pending' &&
                setIsLoading &&
                onClose && (
                    <Button
                        disabled={isLoading}
                        onClick={async () => {
                            setIsLoading(true)
                            try {
                                const result = await mantecaApi.cancelDeposit(transaction.id)
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

            {/* support link section or passkey docs for test transactions */}
            {transaction.userName === 'Enjoy Peanut!' ? (
                <PasskeyDocsLink className="border-t-0 pt-0" />
            ) : (
                <button
                    onClick={() => setIsSupportModalOpen(true)}
                    className="flex w-full items-center justify-center gap-2 text-sm font-medium text-grey-1 underline transition-colors hover:text-black"
                >
                    <Icon name="peanut-support" size={16} className="text-grey-1" />
                    Issues with this transaction?
                </button>
            )}

            {/* Cancel Link Modal  */}

            {setIsLoading && onClose && (
                <CancelSendLinkModal
                    showCancelLinkModal={showCancelLinkModal}
                    setshowCancelLinkModal={setShowCancelLinkModal}
                    amount={amountDisplay}
                    isLoading={isLoading}
                    onClick={async () => {
                        try {
                            setIsLoading(true)
                            setCancelLinkText('Cancelling')

                            if (!user?.accounts) {
                                throw new Error('User not found for cancellation')
                            }
                            const walletAddress = user.accounts.find((acc) => acc.type === 'peanut-wallet')?.identifier
                            if (!walletAddress) {
                                throw new Error('No wallet address found for cancellation')
                            }

                            // Validate transaction data
                            if (!transaction.extraDataForDrawer?.link) {
                                throw new Error('No link found for cancellation')
                            }

                            // Cancel the link by claiming it back
                            await cancelLinkAndClaim({
                                link: transaction.extraDataForDrawer.link,
                                walletAddress,
                                userId: user?.user?.userId,
                            })

                            try {
                                // Wait for transaction confirmation
                                const isConfirmed = await pollForClaimConfirmation(transaction.extraDataForDrawer.link)

                                if (!isConfirmed) {
                                    console.warn('Transaction confirmation timeout - proceeding with refresh')
                                }

                                // Update UI and queries
                                fetchBalance()
                                await queryClient.invalidateQueries({ queryKey: [TRANSACTIONS] })

                                setIsLoading(false)
                                setShowCancelLinkModal(false)
                                setCancelLinkText('Cancelled')
                                toast.success('Link cancelled successfully!')

                                // Brief delay for toast visibility
                                await new Promise((resolve) => setTimeout(resolve, 1500))
                                onClose()
                            } catch (invalidateError) {
                                console.error('Failed to update after claim:', invalidateError)
                                captureException(invalidateError, {
                                    tags: { feature: 'cancel-link' },
                                    extra: { userId: user?.user?.userId },
                                })

                                // Still close drawer even if invalidation fails
                                setIsLoading(false)
                                setShowCancelLinkModal(false)
                                setCancelLinkText('Cancelled')
                                toast.success('Link cancelled! Refresh to see updated balance.')
                                await new Promise((resolve) => setTimeout(resolve, 1500))
                                onClose()
                            }
                        } catch (error: any) {
                            captureException(error)
                            console.error('Error claiming link:', error)
                            setIsLoading(false)
                            setCancelLinkText('Cancel link')
                            toast.error('Failed to cancel link. Please try again.')
                        }
                    }}
                />
            )}

            {requestPotContributors.length > 0 && (
                <>
                    <h2 className="text-base font-bold text-black">Contributors ({requestPotContributors.length})</h2>
                    <div className="overflow-y-auto">
                        {requestPotContributors.map((contributor, index) => (
                            <ContributorCard
                                position={getCardPosition(index, requestPotContributors.length)}
                                key={contributor.uuid}
                                contributor={contributor}
                            />
                        ))}
                    </div>
                </>
            )}
        </div>
    )
}
