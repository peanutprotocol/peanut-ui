'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import Card from '@/components/Global/Card'
import CopyToClipboard from '@/components/Global/CopyToClipboard'
import { Icon } from '@/components/Global/Icons/Icon'
import { STAR_STRAIGHT_ICON } from '@/assets/icons'
import { ReceiptRow } from '@/components/TransactionDetails/ReceiptRow'
import { ReceiptTokenRows } from '@/components/TransactionDetails/ReceiptTokenRows'
import { type ReceiptViewModel } from '@/components/TransactionDetails/useReceiptViewModel'
import { type TransactionDetails } from '@/components/TransactionDetails/transactionTransformer'
import { useReceiptDateFormatter } from '@/components/TransactionDetails/useReceiptDateFormatter'
import { bankAccountLabelKey, getAccountCopyValue, type BankAccountLabelKey } from './transaction-details.utils'
import { usesCompletedTimestampLabel } from './transaction-predicates'
import { CardPaymentRows } from './provider-rows/CardPaymentRows'
import { MantecaDepositInfo } from './provider-rows/MantecaDepositInfo'
import { BridgeDepositInstructions } from './provider-rows/BridgeDepositInstructions'
import { EHistoryUserRole } from '@/hooks/useTransactionHistory'
import { maskAccountIdentifier } from '@/utils/account-mask.utils'
import { formatAmount, formatCurrency } from '@/utils/general.utils'
import { formatPoints } from '@/utils/format.utils'
import { printableAddress, shortenAddress, shortenStringLong } from '@/utils/general.utils'
import { RequestPotProgressRow } from './provider-rows/RequestPotProgressRow'
import { RequestPotContributorRows } from './provider-rows/RequestPotContributorRows'

// IBAN / CLABE are the standard scheme names — same in every locale.
const BANK_ACCOUNT_SCHEME_LABELS: Partial<Record<BankAccountLabelKey, string>> = {
    iban: 'IBAN',
    clabe: 'CLABE',
}

/**
 * The receipt's details card (DS 09, TX Details board 17490:115877 — "Always
 * use receipt style here"). One Card owns the layout: horizontal padding +
 * dashed dividers between rows via `divide-y`, so no row (or provider
 * sub-row) carries border logic of its own. Request pots also own their
 * progress bar and contributors list here, per the Activity/Request board.
 */
export function ReceiptDetailsCard({
    transaction,
    vm,
    shouldShowQrShare,
    convertedAmount,
}: {
    transaction: TransactionDetails
    vm: ReceiptViewModel
    shouldShowQrShare: boolean
    /** "BRL 15.00" — local-fiat / destination-token equivalent for the
     *  "Estimate conversion" row (board 17835:84507). */
    convertedAmount?: string
}) {
    const t = useTranslations('transaction')
    const tCommon = useTranslations('common')
    const router = useRouter()
    const formatDate = useReceiptDateFormatter()
    const { rowVisibilityConfig, isGuestBankClaim, isPeanutWalletToken, country } = vm

    const bankAccountLabel = (type: string) => {
        const key = bankAccountLabelKey(type)
        if (key === 'address') return t('rows.address')
        return BANK_ACCOUNT_SCHEME_LABELS[key] ?? t('rows.accountNumber')
    }

    const getCompletedLabel = () => {
        // Bank off-ramps / on-ramps / bank claims → "Completed" (lifecycle
        // milestone of a bank transfer, not a peer interaction).
        if (usesCompletedTimestampLabel(transaction)) return t('rows.completed')
        return transaction.extraDataForDrawer?.originalUserRole === EHistoryUserRole.SENDER
            ? t('rows.sent')
            : t('rows.received')
    }

    const feeDisplay = transaction.fee !== undefined ? formatAmount(transaction.fee as number) : 'N/A'

    return (
        <Card
            position={shouldShowQrShare ? 'first' : 'single'}
            className="divide-y divide-dashed divide-border-default px-4 py-0"
        >
            {/* Request-pot progress (board): first row of the card. */}
            <RequestPotProgressRow transaction={transaction} />

            {rowVisibilityConfig.createdAt && (
                <ReceiptRow label={t('rows.created')} value={formatDate(new Date(transaction.createdAt!.toString()))} />
            )}

            {rowVisibilityConfig.cancelled && (
                <ReceiptRow
                    label={t('rows.cancelled')}
                    value={formatDate(new Date(transaction.cancelledDate || transaction.createdAt || transaction.date))}
                />
            )}

            {rowVisibilityConfig.claimed && (
                <ReceiptRow label={t('rows.claimed')} value={formatDate(new Date(transaction.claimedAt!))} />
            )}

            {rowVisibilityConfig.completed && (
                <ReceiptRow label={getCompletedLabel()} value={formatDate(new Date(transaction.completedAt!))} />
            )}

            {rowVisibilityConfig.refunded && (
                <ReceiptRow label={t('rows.refunded')} value={formatDate(new Date(transaction.date))} />
            )}

            {rowVisibilityConfig.closed && transaction.cancelledDate && (
                <ReceiptRow label={t('rows.closedAt')} value={formatDate(new Date(transaction.cancelledDate))} />
            )}

            {/* Contributors after the date rows, per the request board. */}
            <RequestPotContributorRows vm={vm} />

            {rowVisibilityConfig.to && (
                <ReceiptRow
                    label={t('rows.to')}
                    value={
                        <div className="flex items-center gap-2">
                            {/* printableAddress shortens Solana/Tron/EVM and passes
                                usernames through — no viem isAddress pre-guard, which
                                is EVM-only and let 44-char Solana counterparties
                                render full-length. */}
                            <span>{printableAddress(transaction.userName)}</span>
                            <CopyToClipboard textToCopy={transaction.userName} iconSize="4" />
                        </div>
                    }
                />
            )}

            {rowVisibilityConfig.tokenAndNetwork && (
                <ReceiptTokenRows transaction={transaction} isPeanutWalletToken={isPeanutWalletToken} />
            )}

            {rowVisibilityConfig.txId && transaction.txHash && (
                <ReceiptRow
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
                />
            )}

            {rowVisibilityConfig.cardPayment && <CardPaymentRows transaction={transaction} />}

            {rowVisibilityConfig.fee && <ReceiptRow label={t('rows.fee')} value={feeDisplay} />}

            {rowVisibilityConfig.mantecaDepositInfo && (
                <MantecaDepositInfo transaction={transaction} country={country} />
            )}

            {/* Local-fiat / destination-token equivalent (board: "Estimate
                conversion ≈ BRL 15.00"), suppressed on cancelled receipts
                like the other money rows. */}
            {convertedAmount && transaction.status !== 'cancelled' && (
                <ReceiptRow label={t('rows.estimateConversion')} value={`≈ ${convertedAmount}`} />
            )}

            {/* Exchange rate and original currency for completed bank_deposit transactions */}
            {rowVisibilityConfig.exchangeRate && transaction.extraDataForDrawer?.receipt?.exchange_rate && (
                <ReceiptRow
                    label={t('rows.exchangeRate')}
                    value={`1 USD = ${transaction.currency!.code?.toUpperCase()} ${formatCurrency(transaction.extraDataForDrawer.receipt.exchange_rate, 4)}`}
                />
            )}

            {rowVisibilityConfig.bankAccountDetails && transaction.bankAccountDetails && (
                <ReceiptRow
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
                                    textToCopy={getAccountCopyValue(
                                        transaction.bankAccountDetails.identifier,
                                        transaction.bankAccountDetails.type
                                    )}
                                    iconSize="4"
                                />
                            )}
                        </div>
                    }
                />
            )}

            {rowVisibilityConfig.transferId && (
                <ReceiptRow
                    label={t('rows.transferId')}
                    value={
                        <div className="flex items-center gap-2">
                            <span>{shortenAddress(transaction.id.toUpperCase(), 20)}</span>
                            <CopyToClipboard textToCopy={transaction.id.toUpperCase()} iconSize="4" />
                        </div>
                    }
                />
            )}

            {/* Onramp deposit instructions for bridge_onramp transactions */}
            {rowVisibilityConfig.depositInstructions && <BridgeDepositInstructions transaction={transaction} />}

            {rowVisibilityConfig.points && transaction.points && (
                <ReceiptRow
                    label={t('rows.pointsEarned')}
                    value={
                        // board 17835:84517: "+11" then the star, right-aligned
                        <div className="flex items-center gap-1">
                            <span>+{formatPoints(transaction.points)}</span>
                            <Image src={STAR_STRAIGHT_ICON} alt="star" width={14} height={14} />
                        </div>
                    }
                    onClick={() => router.push('/rewards')}
                />
            )}

            {rowVisibilityConfig.comment && (
                <ReceiptRow
                    label={tCommon('comment')}
                    value={transaction.memoKey ? t(transaction.memoKey) : transaction.memo}
                />
            )}

            {rowVisibilityConfig.networkFee && (
                <ReceiptRow
                    label={t('rows.networkFee')}
                    value={transaction.networkFeeDetails!.amountDisplay}
                    moreInfoText={transaction.networkFeeDetails!.moreInfoText}
                />
            )}

            {rowVisibilityConfig.peanutFee && (
                <ReceiptRow label={tCommon('peanutFee')} value={tCommon('sponsoredByPeanut')} />
            )}

            {rowVisibilityConfig.attachment && transaction.attachmentUrl && (
                <ReceiptRow
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
                />
            )}
        </Card>
    )
}
