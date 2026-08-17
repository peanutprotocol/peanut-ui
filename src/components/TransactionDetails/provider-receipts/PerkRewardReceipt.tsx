'use client'

import { type RefObject } from 'react'
import { twMerge } from 'tailwind-merge'
import Card from '@/components/Global/Card'
import { PaymentInfoRow } from '@/components/Payment/PaymentInfoRow'
import { Icon } from '@/components/Global/Icons/Icon'
import { PerkIcon } from '@/components/TransactionDetails/PerkIcon'
import { type TransactionDetails } from '@/components/TransactionDetails/transactionTransformer'
import { type HistoryEntryPerkReward } from '@/services/services.types'
import { useModalsContext } from '@/context/ModalsContext'
import { STATUS_LABEL_KEYS } from '@/components/Global/Badges/StatusBadge'
import { useTranslations } from 'next-intl'
import { useReceiptDateFormatter } from '@/components/TransactionDetails/useReceiptDateFormatter'

/**
 * Self-contained receipt for PERK_REWARD entries. Replaces the early-return
 * branch in TransactionDetailsReceipt — Perk has its own header (PerkIcon +
 * "Peanut Reward" copy), its own status pills, and a tiny detail card with
 * date + reason. None of it composes with the generic transaction details
 * card, hence a separate top-level layout instead of slotting into rows.
 */
export function PerkRewardReceipt({
    transaction,
    perkRewardData,
    amountDisplay,
    contentRef,
    className,
}: {
    transaction: TransactionDetails
    perkRewardData: HistoryEntryPerkReward
    amountDisplay: string
    contentRef?: RefObject<HTMLDivElement>
    className?: string
}) {
    const { setIsSupportModalOpen } = useModalsContext()
    const t = useTranslations('transaction')
    const tCommon = useTranslations('common')
    const formatDate = useReceiptDateFormatter()

    return (
        <div ref={contentRef} className={twMerge('space-y-4', className)}>
            {/* Perk Reward Header — top section with logo, amount, and status */}
            <Card position="single" className="px-4 py-6">
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                        <PerkIcon size="medium" />
                        <div className="flex flex-col">
                            <h2 className="text-gray-900 text-lg font-semibold">{t('perk.title')}</h2>
                            <p className="text-gray-900 text-2xl font-bold">{amountDisplay}</p>
                        </div>
                    </div>
                    <div className="flex-shrink-0">
                        {transaction.status === 'completed' ? (
                            <span className="bg-green-100 text-green-700 rounded-full px-3 py-1 text-xs font-medium">
                                {t('perk.statusCompleted')}
                            </span>
                        ) : transaction.status === 'pending' || transaction.status === 'processing' ? (
                            <span className="bg-yellow-100 text-yellow-700 rounded-full px-3 py-1 text-xs font-medium">
                                {tCommon('status.processing')}
                            </span>
                        ) : (
                            <span className="bg-gray-100 text-gray-700 rounded-full px-3 py-1 text-xs font-medium">
                                {tCommon(
                                    (transaction.status && STATUS_LABEL_KEYS[transaction.status]) ?? 'status.unknown'
                                )}
                            </span>
                        )}
                    </div>
                </div>
                <p className="text-gray-600 mt-3 text-sm">{t('perk.subtitle')}</p>
            </Card>

            {/* Perk details — date + reason. Reason has a payment-UUID suffix
                stripped because PerkUsage uses it for idempotency (purchase-
                listener.ts) and shouldn't surface to users. Backend follow-up:
                add requestPaymentUuid column so reason can be clean. */}
            <Card position="single" className="px-4 py-0">
                <PaymentInfoRow
                    label={t('perk.received')}
                    value={formatDate(new Date(transaction.date))}
                    hideBottomBorder={false}
                />
                <PaymentInfoRow
                    label={t('rows.reason')}
                    value={perkRewardData.reason.replace(/\s*\(payment:\s*[a-f0-9-]+\)/i, '')}
                    hideBottomBorder={true}
                />
            </Card>

            <button
                onClick={() => setIsSupportModalOpen(true)}
                className="flex w-full items-center justify-center gap-2 text-sm font-medium text-grey-1 underline transition-colors hover:text-black"
            >
                <Icon name="peanut-support" size={16} className="text-grey-1" />
                {t('actions.reportIssue')}
            </button>
        </div>
    )
}
