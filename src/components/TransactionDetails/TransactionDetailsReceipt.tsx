'use client'

import Card from '@/components/Global/Card'
import { PaymentInfoRow } from '@/components/Payment/PaymentInfoRow'
import { type TransactionDetails } from '@/components/TransactionDetails/transactionTransformer'
import { TRANSACTIONS } from '@/constants/query.consts'
import { EHistoryEntryType, EHistoryUserRole } from '@/hooks/useTransactionHistory'
import { useWallet } from '@/hooks/wallet/useWallet'
import { useUserStore } from '@/redux/hooks'
import { chargesApi } from '@/services/charges'
import { sendLinksApi } from '@/services/sendLinks'
import { formatAmount, formatDate, getInitialsFromName, isStableCoin, formatCurrency, getAvatarUrl } from '@/utils'
import { getDisplayCurrencySymbol } from '@/utils/currency'
import { formatIban, printableAddress, shortenAddress, shortenStringLong, slugify } from '@/utils/general.utils'
import { cancelOnramp } from '@/app/actions/onramp'
import { captureException } from '@sentry/nextjs'
import { useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import Image from 'next/image'
import React, { useMemo, useState, useEffect } from 'react'
import { Button } from '../0_Bruddle'
import DisplayIcon from '../Global/DisplayIcon'
import { Icon } from '../Global/Icons/Icon'
import { STAR_STRAIGHT_ICON } from '@/assets/icons'
import QRCodeWrapper from '../Global/QRCodeWrapper'
import ShareButton from '../Global/ShareButton'
import { TransactionDetailsHeaderCard } from './TransactionDetailsHeaderCard'
import CopyToClipboard from '../Global/CopyToClipboard'
import MoreInfo from '../Global/MoreInfo'
import CancelSendLinkModal from '../Global/CancelSendLinkModal'
import { twMerge } from 'tailwind-merge'
import { isAddress } from 'viem'
import { getBankAccountLabel, type TransactionDetailsRowKey, transactionDetailsRowKeys } from './transaction-details.utils'
import { useSupportModalContext } from '@/context/SupportModalContext'
import { useRouter } from 'next/navigation'
import { countryData } from '@/components/AddMoney/consts'
import {
    MANTECA_COUNTRIES_CONFIG,
    MANTECA_ARG_DEPOSIT_CUIT,
    MANTECA_ARG_DEPOSIT_NAME,
} from '@/constants/manteca.consts'
import { mantecaApi } from '@/services/manteca'
import { getReceiptUrl } from '@/utils/history.utils'
import { PEANUT_WALLET_CHAIN, PEANUT_WALLET_TOKEN_SYMBOL } from '@/constants'

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
    const [showBankDetails, setShowBankDetails] = useState(false)
    const [showCancelLinkModal, setShowCancelLinkModal] = useState(isModalOpen)
    const [tokenData, setTokenData] = useState<{ symbol: string; icon: string } | null>(null)
    const [isTokenDataLoading, setIsTokenDataLoading] = useState(true)
    const { setIsSupportModalOpen } = useSupportModalContext()
    const router = useRouter()
    const [cancelLinkText, setCancelLinkText] = useState<'Cancelling' | 'Cancelled' | 'Cancel link'>('Cancel link')

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
            peanutFee: !!(transaction.extraDataForDrawer?.perk?.claimed && transaction.status !== 'pending'),
            points: !!(transaction.points && transaction.points > 0),
            comment: !!transaction.memo?.trim(),
            networkFee: !!(transaction.networkFeeDetails && transaction.sourceView === 'status'),
            attachment: !!transaction.attachmentUrl,
            mantecaDepositInfo:
                !isPublic &&
                transaction.extraDataForDrawer?.originalType === EHistoryEntryType.MANTECA_ONRAMP &&
                transaction.status === 'pending',
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

    if (!transaction) return null

    let usdAmount: number | bigint = 0

    if (transactionAmount) {
        // if transactionAmount is provided as a string, parse it
        const parsed = parseFloat(transactionAmount.replace(/[\+\-\$]/g, ''))
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
    const amountDisplay = `$ ${formatCurrency(Math.abs(safeAmount).toString())}`

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

    // Show profile button only if txn is completed, not to/by a guest user and its a send/request/receive txn
    const showUserProfileButton =
        !!transaction &&
        transaction.status === 'completed' &&
        !!transaction.userName &&
        !isAddress(transaction.userName) &&
        (transaction.extraDataForDrawer?.transactionCardType === 'send' ||
            transaction.extraDataForDrawer?.transactionCardType === 'request' ||
            transaction.extraDataForDrawer?.transactionCardType === 'receive')

    return (
        <div ref={contentRef} className={twMerge('space-y-4', className)}>
            {/* show qr code at the top if applicable */}
            {shouldShowQrShare && transaction.extraDataForDrawer?.link && (
                <QRCodeWrapper url={transaction.extraDataForDrawer.link} />
            )}

            {/* Perk banner */}
            {transaction.extraDataForDrawer?.perk?.claimed && transaction.status === 'completed' && (
                <Card position="single" className="px-4 py-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-yellow-400">
                            <Image src={STAR_STRAIGHT_ICON} alt="Perk" width={22} height={22} />
                        </div>
                        <div className="flex flex-col gap-1">
                            <span className="font-semibold text-gray-900">Peanut got you!</span>
                            <span className="text-sm text-gray-600">
                                We sponsored this bill! Earn points, climb tiers, and unlock even better perks.
                            </span>
                        </div>
                    </div>
                </Card>
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
                avatarUrl={avatarUrl ?? getAvatarUrl(transaction)}
                haveSentMoneyToUser={transaction.haveSentMoneyToUser}
                hasPerk={!!transaction.extraDataForDrawer?.perk?.claimed}
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
                            {transaction.extraDataForDrawer?.receipt?.exchange_rate && (
                                <PaymentInfoRow
                                    label={`Value in ${transaction.currency!.code}`}
                                    value={`${transaction.currency!.code} ${formatCurrency(transaction.currency!.amount)}`}
                                />
                            )}
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
                            value={'Sponsored by Peanut!'}
                            hideBottomBorder={shouldHideBorder('peanutFee')}
                        />
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

            {shouldShowShareReceipt && !!getReceiptUrl(transaction) && (
                <div className="pr-1">
                    <ShareButton url={getReceiptUrl(transaction)!}>Share Receipt</ShareButton>
                </div>
            )}

            {showUserProfileButton && (
                <div className="pr-1">
                    <Button
                        onClick={() => router.push(`/${transaction.userName}`)}
                        shadowSize="4"
                        variant={
                            transaction.extraDataForDrawer?.transactionCardType === 'request'
                                ? 'purple'
                                : 'primary-soft'
                        }
                        className="flex w-full items-center gap-1"
                    >
                        Go to {transaction.userName} profile
                    </Button>
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

            {/* support link section */}
            <button
                onClick={() => setIsSupportModalOpen(true)}
                className="flex w-full items-center justify-center gap-2 text-sm font-medium text-grey-1 underline transition-colors hover:text-black"
            >
                <Icon name="peanut-support" size={16} className="text-grey-1" />
                Issues with this transaction?
            </button>

            {/* Cancel Link Modal  */}

            {setIsLoading && onClose && (
                <CancelSendLinkModal
                    showCancelLinkModal={showCancelLinkModal}
                    setshowCancelLinkModal={setShowCancelLinkModal}
                    amount={amountDisplay}
                    onClick={() => {
                        setIsLoading(true)
                        setCancelLinkText('Cancelling')
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
                                        .then(async () => {
                                            setIsLoading(false)
                                            setCancelLinkText('Cancelled')
                                            await new Promise((resolve) => setTimeout(resolve, 2000))
                                            onClose()
                                        })
                                }, 3000)
                            })
                            .catch((error) => {
                                captureException(error)
                                console.error('Error claiming link:', error)
                                setIsLoading(false)
                                setCancelLinkText('Cancel link')
                            })
                    }}
                />
            )}
        </div>
    )
}
