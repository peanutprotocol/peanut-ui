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
import { EHistoryUserRole } from '@/hooks/useTransactionHistory'
import { useWallet } from '@/hooks/wallet/useWallet'
import { useUserStore } from '@/redux/hooks'
import { chargesApi } from '@/services/charges'
import useClaimLink from '@/components/Claim/useClaimLink'
import { formatAmount, isStableCoin, formatCurrency } from '@/utils/general.utils'
import { formatPoints } from '@/utils/format.utils'
import { getAvatarUrl } from '@/utils/history.utils'
import { formatIban, printableAddress, shortenAddress, shortenStringLong, slugify } from '@/utils/general.utils'
import { maskAccountIdentifier } from '@/utils/account-mask.utils'
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
import { bankAccountLabelKey, type BankAccountLabelKey } from './transaction-details.utils'
import { useModalsContext } from '@/context/ModalsContext'
import { useRouter } from 'next/navigation'
import { getBankAccountCountryCode } from '@/constants/countryCurrencyMapping'
import { useToast } from '@/components/0_Bruddle/Toast'
import {
    hasUserProfile,
    isPerkReward as isPerkRewardTransaction,
    isRequestEntry,
    isSendLinkEntry,
    isSplittable,
    usesCompletedTimestampLabel,
} from './transaction-predicates'
import { useReceiptViewModel } from './useReceiptViewModel'
import { useReceiptDateFormatter } from './useReceiptDateFormatter'
import { buildSplitBillRequestUrl } from './splitBill.utils'
import { CardPaymentRows } from './provider-rows/CardPaymentRows'
import { LocalRailNudge } from './provider-rows/LocalRailNudge'
import { CardUsdAbroadNotice } from './provider-rows/CardUsdAbroadNotice'
import { MantecaDepositInfo } from './provider-rows/MantecaDepositInfo'
import { BridgeDepositInstructions } from './provider-rows/BridgeDepositInstructions'
import { CancelDepositActions } from './provider-actions/CancelDepositActions'
import { PerkRewardReceipt } from './provider-receipts/PerkRewardReceipt'
import { getReceiptUrl } from '@/utils/history.utils'
import ContributorCard from '../Global/Contributors/ContributorCard'
import { requestsApi } from '@/services/requests'
import { PasskeyDocsLink } from '../Setup/Views/SignTestTransaction'
import { useActivationStatus } from '@/hooks/useActivationStatus'
import { generateInviteCodeLink } from '@/utils/general.utils'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { useTranslations } from 'next-intl'

type CancelLinkState = 'idle' | 'cancelling' | 'cancelled'

const CANCEL_LINK_KEYS = {
    idle: 'actions.cancelLink',
    cancelling: 'actions.cancelling',
    cancelled: 'actions.cancelled',
} as const satisfies Record<CancelLinkState, string>

// IBAN / CLABE are the standard scheme names — same in every locale.
const BANK_ACCOUNT_SCHEME_LABELS: Partial<Record<BankAccountLabelKey, string>> = {
    iban: 'IBAN',
    clabe: 'CLABE',
}

export const TransactionDetailsReceipt = ({
    transaction,
    onClose,
    isLoading,
    setIsLoading,
    contentRef,
    transactionAmount,
    className,
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
    const t = useTranslations('transaction')
    const tCommon = useTranslations('common')
    const formatDate = useReceiptDateFormatter()
    const bankAccountLabel = (type: string) =>
        BANK_ACCOUNT_SCHEME_LABELS[bankAccountLabelKey(type)] ?? t('rows.accountNumber')
    const [cancelLinkState, setCancelLinkState] = useState<CancelLinkState>('idle')

    // Sync modal state to parent if callback is provided
    useEffect(() => {
        setIsModalOpen?.(showCancelLinkModal)
    }, [showCancelLinkModal, setIsModalOpen])

    // All derived row-visibility / status / share-receipt state lives in the
    // hook so this component stays focused on JSX + callbacks.
    const {
        isGuestBankClaim,
        isPendingBankRequest,
        isPeanutWalletToken,
        isPendingRequestee,
        isPendingRequester,
        isPendingSentLink,
        isQRPayment,
        country,
        rowVisibilityConfig,
        shouldHideBorder,
        shouldShowShareReceipt,
        requestPotContributors,
        formattedTotalAmountCollected,
    } = useReceiptViewModel(transaction, { isPublic })

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
        // Preference order:
        //   1. Local fiat (e.g. ARS for Manteca on/off-ramps) via currency.code/amount
        //   2. Destination token (e.g. ETH for cross-token withdraw) via amount + tokenSymbol
        //      — full decimals here, not truncated, so the receipt is auditable.
        // USD-pegged stablecoins are skipped (same rule as TransactionCard).
        const code = transaction.currency?.code
        const amount = transaction.currency?.amount
        if (code && amount) {
            const upper = code.toUpperCase()
            if (upper !== 'USD' && !isStableCoin(upper)) {
                return `${upper} ${formatCurrency(amount)}`
            }
        }
        const tokenSymbol = transaction.tokenSymbol?.toUpperCase()
        if (tokenSymbol && tokenSymbol !== 'USD' && !isStableCoin(tokenSymbol) && transaction.tokenAmount) {
            return `${transaction.tokenAmount} ${tokenSymbol}`
        }
        return null
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

    // QR + Share + Cancel block: pending, has a link, and either the sender of
    // a send-link OR the recipient of a request. Both gates route through the
    // kind-keyed predicates so adding a new flow only needs a predicate update.
    const shouldShowQrShare =
        transaction.status === 'pending' &&
        !!transaction.extraDataForDrawer?.link &&
        ((isSendLinkEntry(transaction) &&
            transaction.extraDataForDrawer.originalUserRole === EHistoryUserRole.SENDER) ||
            (isRequestEntry(transaction) &&
                transaction.extraDataForDrawer.originalUserRole === EHistoryUserRole.RECIPIENT))

    const getLabelText = (transaction: TransactionDetails) => {
        // Bank off-ramps / on-ramps / bank claims → "Completed" (lifecycle
        // milestone of a bank transfer, not a peer interaction).
        if (usesCompletedTimestampLabel(transaction)) return t('rows.completed')
        return transaction.extraDataForDrawer?.originalUserRole === EHistoryUserRole.SENDER
            ? t('rows.sent')
            : t('rows.received')
    }

    if (transaction.isRequestPotLink && Number(transaction.amount) > 0) {
        amountDisplay = `$${formatCurrency(transaction.amount.toString())}`
    } else if (transaction.isRequestPotLink && Number(transaction.amount) === 0) {
        amountDisplay = t('amountCollected', { amount: formattedTotalAmountCollected })
    }

    // Show profile button only if it's a send/request/receive to a real Peanut
    // user (not a link or a raw address). Shared with the history row — see
    // hasUserProfile.
    const isAvatarClickable = hasUserProfile(transaction)

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
                // Use the raw numeric field, NOT formattedTotalAmountCollected — the
                // latter is comma-grouped ("1,234.56"), so Number() → NaN for any pot
                // that has collected ≥ $1,000, blanking the progress bar.
                progress={Number(transaction.totalAmountCollected)}
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
                            <span className="font-semibold text-gray-900">{t('perkBanner.title')}</span>
                            <span className="text-sm text-gray-600">
                                {(() => {
                                    const perk = transaction.extraDataForDrawer.perk
                                    const amount = perk.amountSponsored

                                    // Always show actual dollar amount — never percentage (misleading due to dynamic caps)
                                    if (amount !== undefined && amount !== null) {
                                        const formatted = formatCurrency(amount.toString())
                                        if (perk.isCapped && perk.campaignCapUsd) {
                                            return t('perkBanner.capped', { amount: formatted })
                                        }
                                        return t('perkBanner.received', { amount: formatted })
                                    }

                                    return t('perkBanner.generic')
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
                            label={t('rows.created')}
                            value={formatDate(new Date(transaction.createdAt!.toString()))}
                            hideBottomBorder={shouldHideBorder('createdAt')}
                        />
                    )}

                    {rowVisibilityConfig.cancelled && (
                        <PaymentInfoRow
                            label={t('rows.cancelled')}
                            value={formatDate(
                                new Date(transaction.cancelledDate || transaction.createdAt || transaction.date)
                            )}
                            hideBottomBorder={shouldHideBorder('cancelled')}
                        />
                    )}

                    {rowVisibilityConfig.claimed && (
                        <PaymentInfoRow
                            label={t('rows.claimed')}
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
                            label={t('rows.refunded')}
                            value={formatDate(new Date(transaction.date))}
                            hideBottomBorder={shouldHideBorder('refunded')}
                        />
                    )}

                    {rowVisibilityConfig.closed && (
                        <>
                            {transaction.cancelledDate && (
                                <PaymentInfoRow
                                    label={t('rows.closedAt')}
                                    value={formatDate(new Date(transaction.cancelledDate))}
                                    hideBottomBorder={shouldHideBorder('closed')}
                                />
                            )}
                        </>
                    )}

                    {rowVisibilityConfig.to && (
                        <PaymentInfoRow
                            label={t('rows.to')}
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
                                    <PaymentInfoRow label={t('rows.tokenAmount')} value={transaction.amount} />
                                )}
                                {!isPeanutWalletToken && (
                                    <PaymentInfoRow
                                        label={t('rows.tokenAndNetwork')}
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
                                                        {t('rows.tokenOnChain', {
                                                            token: tokenData.symbol.toUpperCase(),
                                                            chain: transaction.tokenDisplayDetails.chainName ?? '',
                                                        })}
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
                            label={t('rows.txId')}
                            value={
                                transaction.explorerUrl ? (
                                    <Link
                                        href={transaction.explorerUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-2 hover:underline"
                                    >
                                        <span>{shortenStringLong(transaction.txHash)}</span>
                                        <Icon name="external-link" size={14} />
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
                        <PaymentInfoRow
                            label={t('rows.fee')}
                            value={feeDisplay}
                            hideBottomBorder={shouldHideBorder('fee')}
                        />
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
                                    label={t('rows.exchangeRate')}
                                    value={`1 USD = ${transaction.currency!.code?.toUpperCase()} ${formatCurrency(transaction.extraDataForDrawer.receipt.exchange_rate, 4)}`}
                                    hideBottomBorder={shouldHideBorder('exchangeRate')}
                                />
                            )}
                        </>
                    )}

                    {rowVisibilityConfig.bankAccountDetails && transaction.bankAccountDetails && (
                        <PaymentInfoRow
                            label={bankAccountLabel(transaction.bankAccountDetails!.type)}
                            value={
                                <div className="flex items-center gap-2">
                                    <span>
                                        {isGuestBankClaim
                                            ? transaction.bankAccountDetails.identifier
                                            : maskAccountIdentifier(
                                                  transaction.bankAccountDetails.identifier,
                                                  transaction.bankAccountDetails.type
                                              )}
                                    </span>
                                    {!isGuestBankClaim && (
                                        // Copy yields the FULL identifier — masking is for
                                        // visual privacy only; the user owns the account
                                        // and may need to paste it elsewhere.
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
                            label={t('rows.transferId')}
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
                    {rowVisibilityConfig.depositInstructions && <BridgeDepositInstructions transaction={transaction} />}

                    {rowVisibilityConfig.points && transaction.points && (
                        <PaymentInfoRow
                            label={t('rows.pointsEarned')}
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
                            label={tCommon('comment')}
                            value={transaction.memo}
                            hideBottomBorder={shouldHideBorder('comment')}
                        />
                    )}

                    {rowVisibilityConfig.networkFee && (
                        <PaymentInfoRow
                            label={t('rows.networkFee')}
                            value={transaction.networkFeeDetails!.amountDisplay}
                            moreInfoText={transaction.networkFeeDetails!.moreInfoText}
                            hideBottomBorder={shouldHideBorder('networkFee')}
                        />
                    )}

                    {rowVisibilityConfig.peanutFee && (
                        <PaymentInfoRow
                            label={t('rows.peanutFee')}
                            value={t('rows.peanutFeeSponsored')}
                            hideBottomBorder={shouldHideBorder('peanutFee')}
                        />
                    )}

                    {rowVisibilityConfig.attachment && transaction.attachmentUrl && (
                        <PaymentInfoRow
                            label={t('rows.attachment')}
                            value={
                                <Link
                                    href={transaction.attachmentUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-center underline"
                                >
                                    {t('rows.download')}
                                    <Icon name="download" size={14} />
                                </Link>
                            }
                            hideBottomBorder
                        />
                    )}
                </div>
            </Card>

            {/* Local-rail nudge — card spends in a country with a cheaper
                first-party rail (AR → QR, BR → Pix). Self-gates: renders
                nothing for other countries / non-card-spend transactions.
                Hidden on public receipts (same rule as the referral nudge). */}
            {!isPublic && <LocalRailNudge transaction={transaction} />}

            {/* DCC trap: a spend abroad billed in USD (the terminal's "pay in
                dollars?" option) gets a worse rate than paying local. Nudge the
                user to pick local currency next time. Suppressed in AR/BR where
                LocalRailNudge already fires. */}
            {!isPublic && <CardUsdAbroadNotice transaction={transaction} />}

            {/* share and cancel buttons section (only if qr is shown) */}
            {shouldShowQrShare && transaction.extraDataForDrawer?.link && (
                <div className="space-y-2 pr-1">
                    {' '}
                    {/* added space-y for button separation */}
                    <ShareButton url={transaction.extraDataForDrawer.link} title={t('actions.shareLinkTitle')}>
                        {t('actions.shareLink')}
                    </ShareButton>
                    {/* show cancel button only if the current user sent the link/request */}
                    {(isSendLinkEntry(transaction) || isRequestEntry(transaction)) &&
                        transaction.extraDataForDrawer.originalUserRole === EHistoryUserRole.SENDER &&
                        setIsLoading &&
                        onClose && (
                            <Button
                                disabled={isLoading || cancelLinkState === 'cancelled'}
                                onClick={() => setShowCancelLinkModal(true)}
                                loading={isLoading}
                                variant={'primary-soft'}
                                className="flex w-full items-center gap-1"
                                shadowSize="4"
                            >
                                <div className="flex items-center">{!isLoading && <Icon name="ban" size={18} />}</div>
                                <span>{t(CANCEL_LINK_KEYS[cancelLinkState])}</span>
                            </Button>
                        )}
                </div>
            )}

            {isPendingSentLink && !shouldShowQrShare && (
                <div className="flex items-center justify-center gap-1.5 text-center text-xs font-semibold text-grey-1">
                    <Icon name="info" size={20} />
                    {t('pendingLinkDeviceNote')}
                </div>
            )}

            {isPendingRequester && setIsLoading && onClose && (
                <div className="pr-1">
                    <Button
                        icon="ban"
                        iconSize={18}
                        loading={isLoading}
                        disabled={isLoading}
                        onClick={closeRequestLink}
                        variant={'primary-soft'}
                        shadowSize="4"
                        className="flex w-full items-center gap-1"
                    >
                        {transaction.totalAmountCollected > 0 ? t('actions.closeRequest') : t('actions.cancelRequest')}
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
                        <Icon name="currency" size={18} />
                        {t('actions.pay')}
                    </Button>
                    <Button
                        icon="ban"
                        iconSize={18}
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
                        {t('actions.rejectRequest')}
                    </Button>
                </div>
            )}

            {!isPublic && isSplittable(transaction) && (
                <Button
                    onClick={() => router.push(buildSplitBillRequestUrl(transaction.amount, transaction.userName))}
                    icon="split"
                    shadowSize="4"
                >
                    {t('actions.splitBill')}
                </Button>
            )}

            {shouldShowShareReceipt && !!getReceiptUrl(transaction) && (
                <div className="pr-1">
                    <ShareButton variant={isQRPayment ? 'primary-soft' : 'purple'} url={getReceiptUrl(transaction)!}>
                        {t('actions.shareReceipt')}
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

            {/* Referral nudge for activated users on completed outbound transactions.
                QR pay is excluded — it already shows Split + Share, and a third button
                stacks the drawer past the comfortable 2-CTA ceiling. */}
            {!isPublic &&
                isActivated &&
                transaction.status === 'completed' &&
                ['send', 'withdraw', 'bank_withdraw'].includes(transaction.direction) &&
                !isPerkReward &&
                user?.user.username && (
                    <Button
                        variant="primary-soft"
                        shadowSize="4"
                        onClick={async () => {
                            const { inviteLink } = generateInviteCodeLink(user.user.username!)
                            posthog.capture(ANALYTICS_EVENTS.INVITE_LINK_SHARED, { source: 'transaction_receipt' })
                            try {
                                if (navigator.share) {
                                    await navigator.share({ url: inviteLink })
                                } else {
                                    await navigator.clipboard.writeText(inviteLink)
                                    // Desktop fallback: navigator.share is mobile-only.
                                    // Without a toast the click is silent and users assume
                                    // the button is broken.
                                    toast.info(t('toast.inviteLinkCopied'))
                                }
                            } catch {
                                // user cancelled share sheet — ignore
                            }
                        }}
                    >
                        <Icon name="invite-heart" size={16} />
                        <span className="text-sm font-medium">{t('actions.inviteFriends')}</span>
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
                    {t('actions.reportIssue')}
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
                            setCancelLinkState('cancelling')

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
                                setCancelLinkState('cancelled')
                                toast.success(t('toast.linkCancelled'))

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
                                setCancelLinkState('cancelled')
                                toast.success(t('toast.linkCancelledRefresh'))
                                await new Promise((resolve) => setTimeout(resolve, 1500))
                                onClose()
                            }
                        } catch (error) {
                            captureException(error)
                            console.error('Error claiming link:', error)
                            setIsLoading(false)
                            setCancelLinkState('idle')
                            toast.error(t('toast.cancelLinkFailed'))
                        }
                    }}
                />
            )}

            {requestPotContributors.length > 0 && (
                <>
                    <h2 className="text-base font-bold text-black">
                        {t('contributors', { count: requestPotContributors.length })}
                    </h2>
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
