'use client'

import React, { useMemo } from 'react'
import { twMerge } from 'tailwind-merge'
import { useAppTranslations } from '@/i18n/app/useAppTranslations'
import Card from '@/components/Global/Card'
import QRCodeWrapper from '@/components/Global/QRCodeWrapper'
import { type TransactionDetails } from '@/components/TransactionDetails/transactionTransformer'
import { EHistoryUserRole } from '@/hooks/useTransactionHistory'
import { getBankAccountCountryCode } from '@/constants/countryCurrencyMapping'
import { getAvatarUrl, getTransactionSign } from '@/utils/history.utils'
import { formatCurrency, isStableCoin } from '@/utils/general.utils'
import { PerkIcon } from './PerkIcon'
import { ReceiptActions } from './ReceiptActions'
import { ReceiptDetailsCard } from './ReceiptDetailsCard'
import { TransactionDetailsHeaderCard } from './TransactionDetailsHeaderCard'
import { LocalRailNudge } from './provider-rows/LocalRailNudge'
import { CardUsdAbroadNotice } from './provider-rows/CardUsdAbroadNotice'
import { CardAdjustmentNotice } from './provider-rows/CardAdjustmentNotice'
import { PerkRewardReceipt } from './provider-receipts/PerkRewardReceipt'
import {
    hasUserProfile,
    hasUserProfileAvatar,
    isPerkReward as isPerkRewardTransaction,
    isRequestEntry,
    isSendLinkEntry,
} from './transaction-predicates'
import { useReceiptViewModel } from './useReceiptViewModel'

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
    const t = useAppTranslations('transaction')

    // All derived row-visibility / status / share-receipt state lives in the
    // hook so this component stays focused on composition.
    const vm = useReceiptViewModel(transaction, { isPublic })
    const { formattedTotalAmountCollected } = vm

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

    if (transaction.isRequestPotLink && Number(transaction.amount) > 0) {
        amountDisplay = `$${formatCurrency(transaction.amount.toString())}`
    } else if (transaction.isRequestPotLink && Number(transaction.amount) === 0) {
        amountDisplay = t('amountCollected', { amount: formattedTotalAmountCollected })
    }

    // States board (17966:12128): '-' marks outgoing money; incoming stays
    // unsigned (base state — no '+'). Pots show a collected total, never a sign.
    const headSign = !transaction.isRequestPotLink && getTransactionSign(transaction) === '-' ? '-' : ''

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

    // the counterparty name links whenever the peer has a real profile. the
    // avatar links only when it visually represents that user; bank flags and
    // account icons stay inert.
    const isNameClickable = hasUserProfile(transaction)
    const isAvatarClickable = hasUserProfileAvatar(transaction)

    // Special rendering for PERK_REWARD type
    const perkRewardData = transaction.extraDataForDrawer?.perkReward
    if (isPerkRewardTransaction(transaction) && perkRewardData) {
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
        <div ref={contentRef} className={twMerge('flex flex-col gap-4', className)}>
            {/* head (board 17490:115877): centered bubble → type line → amount → badge */}
            <TransactionDetailsHeaderCard
                direction={transaction.direction}
                userName={transaction.userName}
                nameKey={transaction.nameKey}
                nameParams={transaction.nameParams}
                amountDisplay={amountDisplay}
                sign={headSign}
                initials={transaction.initials}
                status={transaction.status}
                isVerified={transaction.isVerified}
                isLinkTransaction={transaction.extraDataForDrawer?.isLinkTransaction}
                transactionType={transaction.extraDataForDrawer?.transactionCardType}
                avatarUrl={avatarUrl ?? getAvatarUrl(transaction)}
                haveSentMoneyToUser={transaction.haveSentMoneyToUser}
                isNameClickable={isNameClickable}
                isAvatarClickable={isAvatarClickable}
                isRequestPotTransaction={transaction.isRequestPotLink}
                showFullName={transaction.showFullName}
                fullName={transaction.fullName}
                countryCode={getBankAccountCountryCode(transaction.bankAccountDetails, transaction.currency?.code)}
            />

            {/* Perk eligibility banner */}
            {transaction.extraDataForDrawer?.perk?.claimed && transaction.status !== 'pending' && (
                <Card position="single" className="p-4">
                    <div className="flex items-center gap-3">
                        <PerkIcon size="small" />
                        <div className="flex flex-col gap-1">
                            <span className="text-body-m-semibold text-foreground-primary">
                                {t('perkBanner.title')}
                            </span>
                            <span className="text-body-s text-foreground-secondary">
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

            {/* the one receipt-style card (dates, conversion, fee, memo,
                provider rows, pot progress + contributors) */}
            <ReceiptDetailsCard
                transaction={transaction}
                vm={vm}
                shouldShowQrShare={shouldShowQrShare}
                convertedAmount={convertedAmount ?? undefined}
            />

            {/* Over-capture explainer — the words for the Initial hold /
                Adjustment rows in the details card and the merchant-recourse
                path. First of the notices: it explains THIS receipt's numbers;
                the others nudge future behavior. */}
            {!isPublic && <CardAdjustmentNotice transaction={transaction} />}

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

            {/* CTA zone (board): QR for shareable pending links/requests sits
                with the CTAs, not above the head. */}
            {shouldShowQrShare && transaction.extraDataForDrawer?.link && (
                <QRCodeWrapper url={transaction.extraDataForDrawer.link} />
            )}

            <ReceiptActions
                transaction={transaction}
                vm={vm}
                isPublic={isPublic}
                amountDisplay={amountDisplay}
                shouldShowQrShare={shouldShowQrShare}
                isLoading={isLoading}
                setIsLoading={setIsLoading}
                onClose={onClose}
                setIsModalOpen={setIsModalOpen}
            />
        </div>
    )
}
