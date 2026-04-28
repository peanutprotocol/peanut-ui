'use client'
/**
 * @todo This file needs significant DRY (Don't Repeat Yourself) refactoring and consolidation
 * - Multiple repeated UI patterns and logic that could be extracted into reusable components
 * - Complex conditional rendering that could be simplified
 * - Duplicated status/type checking logic that could be centralized
 * - Large component that could be split into smaller focused components
 */

import Card from '@/components/Global/Card'
import { getCardPosition } from '@/components/Global/Card/card.utils'
import { PaymentInfoRow } from '@/components/Payment/PaymentInfoRow'
import { type TransactionDetails } from '@/components/TransactionDetails/transactionTransformer'
import { TRANSACTIONS } from '@/constants/query.consts'
import { EHistoryEntryType, EHistoryUserRole } from '@/hooks/useTransactionHistory'
import { useWallet } from '@/hooks/wallet/useWallet'
import { useUserStore } from '@/redux/hooks'
import { chargesApi } from '@/services/charges'
import useClaimLink from '@/components/Claim/useClaimLink'
import { formatAmount, formatDate, isStableCoin, formatCurrency } from '@/utils/general.utils'
import { formatPoints } from '@/utils/format.utils'
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
import CancelSendLinkModal from '../Global/CancelSendLinkModal'
import { twMerge } from 'tailwind-merge'
import { isAddress } from 'viem'
import {
    getBankAccountLabel,
    type TransactionDetailsRowKey,
    transactionDetailsRowKeys,
} from './transaction-details.utils'
import { useModalsContext } from '@/context/ModalsContext'
import { useRouter } from 'next/navigation'
import { countryData } from '@/components/AddMoney/consts'
import { getBankAccountCountryCode } from '@/constants/countryCurrencyMapping'
import { useToast } from '@/components/0_Bruddle/Toast'
import {
    hasShareableReceipt,
    isCardPaymentEntry,
    isQRPayment as isQRPaymentTransaction,
    isPerkReward as isPerkRewardTransaction,
    usesCompletedTimestampLabel,
} from './transaction-predicates'
import { CardPaymentRows } from './provider-rows/CardPaymentRows'
import { MantecaDepositInfo } from './provider-rows/MantecaDepositInfo'
import { BridgeDepositInstructions } from './provider-rows/BridgeDepositInstructions'
import { CancelDepositActions } from './provider-actions/CancelDepositActions'
import { PerkRewardReceipt } from './provider-receipts/PerkRewardReceipt'
import { getReceiptUrl } from '@/utils/history.utils'
import { PEANUT_WALLET_CHAIN, PEANUT_WALLET_TOKEN_SYMBOL } from '@/constants/zerodev.consts'
import ContributorCard from '../Global/Contributors/ContributorCard'
import { requestsApi } from '@/services/requests'
import { PasskeyDocsLink } from '../Setup/Views/SignTestTransaction'
import { useActivationStatus } from '@/hooks/useActivationStatus'
import { generateInviteCodeLink, generateInvitesShareText } from '@/utils/general.utils'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'

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
    const [showCancelLinkModal, setShowCancelLinkModal] = useState(false)
    const [tokenData, setTokenData] = useState<{ symbol: string; icon: string } | null>(null)
    const [isTokenDataLoading, setIsTokenDataLoading] = useState(true)
    const { setIsSupportModalOpen } = useModalsContext()
    const toast = useToast()
    const router = useRouter()
    const { isActivated } = useActivationStatus()
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
        // Hide the "Created" row when the "Sent"/"Completed" row is about to
        // render (both point at the same lifecycle event for off-ramps /
        // bank claims; two rows side-by-side is noise). Keep "Created" as
        // the fallback for pending states where no completion timestamp exists.
        const willShowCompleted = !!(
            transaction.status === 'completed' &&
            transaction.completedAt &&
            transaction.extraDataForDrawer?.originalType !== EHistoryEntryType.DIRECT_SEND
        )
        return {
            createdAt: !!transaction.createdAt && !willShowCompleted,
            to: transaction.direction === 'claim_external',
            tokenAndNetwork: !!(
                transaction.tokenDisplayDetails &&
                transaction.sourceView === 'history' &&
                !isPeanutWalletToken &&
                // hide token and network for send links in acitvity drawer for sender
                !(
                    transaction.extraDataForDrawer?.originalType === EHistoryEntryType.SEND_LINK &&
                    transaction.extraDataForDrawer?.originalUserRole === EHistoryUserRole.SENDER
                ) &&
                // hide token and network for refunded entries
                transaction.status !== 'refunded'
            ),
            txId: !!transaction.txHash,
            // show cancelled row if status is cancelled, use cancelledDate or fallback to createdAt
            cancelled: transaction.status === 'cancelled',
            claimed: !!(transaction.status === 'completed' && transaction.claimedAt),
            completed: !!(
                transaction.status === 'completed' &&
                transaction.completedAt &&
                transaction.extraDataForDrawer?.originalType !== EHistoryEntryType.DIRECT_SEND
            ),
            refunded: transaction.status === 'refunded',
            fee: transaction.fee !== undefined && transaction.status !== 'cancelled',
            exchangeRate: !!(
                (transaction.direction === 'bank_deposit' ||
                    transaction.direction === 'qr_payment' ||
                    transaction.direction === 'bank_withdraw') &&
                transaction.currency?.code &&
                transaction.currency.code.toUpperCase() !== 'USD' &&
                transaction.status !== 'cancelled'
            ),
            bankAccountDetails: !!(
                transaction.bankAccountDetails &&
                transaction.bankAccountDetails.identifier &&
                transaction.status !== 'cancelled'
            ),
            transferId: !!(
                transaction.id &&
                (transaction.direction === 'bank_withdraw' || transaction.direction === 'bank_claim') &&
                transaction.status !== 'cancelled'
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
            points: !!(transaction.points && transaction.points > 0 && transaction.status !== 'cancelled'),
            comment: !!(transaction.memo?.trim() && transaction.status !== 'cancelled'),
            networkFee: !!(
                transaction.networkFeeDetails &&
                transaction.sourceView === 'status' &&
                transaction.status !== 'cancelled'
            ),
            attachment: !!(transaction.attachmentUrl && transaction.status !== 'cancelled'),
            mantecaDepositInfo:
                !isPublic &&
                transaction.extraDataForDrawer?.originalType === EHistoryEntryType.MANTECA_ONRAMP &&
                transaction.status === 'pending',
            // Card-payment slot owns merchant category / location / cross-currency
            // / settlement-adjustment / decline-reason / auto-close note. The
            // CardPaymentRows component decides which sub-rows to render.
            cardPayment: isCardPaymentEntry(transaction),
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
        return hasShareableReceipt(transaction)
    }, [transaction, isPendingSentLink, isPendingRequester, isPendingRequestee])

    const isQRPayment = transaction ? isQRPaymentTransaction(transaction) : false

    const requestPotContributors = useMemo(() => {
        if (!transaction || !transaction.requestPotPayments) return []
        return getContributorsFromCharge(transaction.requestPotPayments)
    }, [transaction])

    const formattedTotalAmountCollected = formatCurrency(transaction?.totalAmountCollected?.toString() ?? '0', 2, 0)

    useEffect(() => {
        const getTokenDetails = async () => {
            if (!transaction?.tokenDisplayDetails) {
                setIsTokenDataLoading(false)
                return
            }

            if (transaction.tokenDisplayDetails.tokenIconUrl && transaction.tokenDisplayDetails.tokenSymbol) {
                setTokenData({
                    symbol: transaction.tokenDisplayDetails.tokenSymbol,
                    icon: transaction.tokenDisplayDetails.tokenIconUrl,
                })
                setIsTokenDataLoading(false)
                return
            }

            if (!transaction.tokenDisplayDetails.chainName) {
                setIsTokenDataLoading(false)
                return
            }

            try {
                const chainName = slugify(transaction.tokenDisplayDetails.chainName)
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
    }, [transaction?.tokenDisplayDetails])

    const convertedAmount = useMemo(() => {
        if (!transaction) return null
        const code = transaction.currency?.code
        const amount = transaction.currency?.amount
        // Show the converted amount below the primary for any non-USD fiat
        // leg — on/offramps, bank claims. The amount carries the effective
        // conversion (fees baked in per Peanut product convention), so there's
        // no need to render the rate separately. Previously this was gated on
        // `receipt.exchange_rate` which Bridge sandbox populates only on true
        // settlement, leaving the row hidden through PAYMENT_PROCESSED; the
        // currency + amount alone are sufficient to render it.
        if (!code || !amount) return null
        if (code.toUpperCase() === 'USD') return null
        return `${code.toUpperCase()} ${formatCurrency(amount)}`
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
        // Bank off-ramps / on-ramps / bank claims → "Completed" (the user isn't
        // sending to another person; it's a lifecycle milestone of a bank transfer).
        if (usesCompletedTimestampLabel(transaction)) return 'Completed'
        return transaction.extraDataForDrawer?.originalUserRole === EHistoryUserRole.SENDER ? 'Sent' : 'Received'
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
    const isPerkReward = isPerkRewardTransaction(transaction)
    const perkRewardData = transaction.extraDataForDrawer?.perkReward

    if (isPerkReward && perkRewardData) {
        return (
            <PerkRewardReceipt
                transaction={transaction}
                perkRewardData={perkRewardData}
                amountDisplay={amountDisplay}
                contentRef={contentRef}
                className={className}
            />
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
                countryCode={getBankAccountCountryCode(transaction.bankAccountDetails, transaction.currency?.code)}
            />

            {/* Perk eligibility banner */}
            {transaction.extraDataForDrawer?.perk?.claimed && transaction.status !== 'pending' && (
                <Card position="single" className="px-4 py-4">
                    <div className="flex items-center gap-3">
                        <PerkIcon size="small" />
                        <div className="flex flex-col gap-1">
                            <span className="font-semibold text-gray-900">You earned a reward!</span>
                            <span className="text-sm text-gray-600">
                                {(() => {
                                    const perk = transaction.extraDataForDrawer.perk
                                    const amount = perk.amountSponsored

                                    // Always show actual dollar amount — never percentage (misleading due to dynamic caps)
                                    if (amount !== undefined && amount !== null) {
                                        if (perk.isCapped && perk.campaignCapUsd) {
                                            return `$${amount.toFixed(2)} reward — campaign limit reached!`
                                        }
                                        return `You received a $${amount.toFixed(2)} reward!`
                                    }

                                    return 'You received a Peanut reward!'
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
                            value={formatDate(
                                new Date(transaction.cancelledDate || transaction.createdAt || transaction.date)
                            )}
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

                    {rowVisibilityConfig.cardPayment && (
                        <CardPaymentRows transaction={transaction} isLastRow={shouldHideBorder('cardPayment')} />
                    )}

                    {rowVisibilityConfig.fee && (
                        <PaymentInfoRow label="Fee" value={feeDisplay} hideBottomBorder={shouldHideBorder('fee')} />
                    )}

                    {rowVisibilityConfig.mantecaDepositInfo && (
                        <MantecaDepositInfo transaction={transaction} country={country} />
                    )}

                    {/* Exchange rate and original currency for completed bank_deposit transactions */}
                    {rowVisibilityConfig.exchangeRate && (
                        <>
                            {/* TODO: stop using snake_case!!!!! */}
                            {transaction.extraDataForDrawer?.receipt?.exchange_rate && (
                                <PaymentInfoRow
                                    label="Exchange rate"
                                    value={`1 USD = ${transaction.currency!.code?.toUpperCase()} ${formatCurrency(transaction.extraDataForDrawer.receipt.exchange_rate, 4)}`}
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
                    {rowVisibilityConfig.depositInstructions && (
                        <BridgeDepositInstructions transaction={transaction} />
                    )}

                    {rowVisibilityConfig.points && transaction.points && (
                        <PaymentInfoRow
                            label="Points earned"
                            value={
                                <div className="flex items-center gap-2">
                                    <Image src={STAR_STRAIGHT_ICON} alt="star" width={16} height={16} />
                                    <span>{formatPoints(transaction.points)}</span>
                                </div>
                            }
                            hideBottomBorder={shouldHideBorder('points')}
                            onClick={() => router.push('/rewards')}
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

            {isQRPayment && transaction.status !== 'refunded' && (
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

            <CancelDepositActions
                transaction={transaction}
                isPendingBankRequest={isPendingBankRequest}
                isLoading={isLoading}
                setIsLoading={setIsLoading}
                onClose={onClose}
            />

            {/* referral nudge for activated users on completed outbound transactions */}
            {isActivated &&
                transaction.status === 'completed' &&
                ['send', 'qr_payment', 'withdraw', 'bank_withdraw'].includes(transaction.direction) &&
                !isPerkReward &&
                user?.user.username && (
                    <Button
                        variant="primary-soft"
                        shadowSize="4"
                        onClick={async () => {
                            const { inviteLink } = generateInviteCodeLink(user.user.username!)
                            const text = generateInvitesShareText(inviteLink)
                            posthog.capture(ANALYTICS_EVENTS.INVITE_LINK_SHARED, { source: 'transaction_receipt' })
                            try {
                                if (navigator.share) {
                                    await navigator.share({ text })
                                } else {
                                    await navigator.clipboard.writeText(text)
                                }
                            } catch {
                                // user cancelled share sheet — ignore
                            }
                        }}
                    >
                        <Icon name="invite-heart" size={16} />
                        <span className="text-sm font-medium">Invite friends to earn more rewards</span>
                    </Button>
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
