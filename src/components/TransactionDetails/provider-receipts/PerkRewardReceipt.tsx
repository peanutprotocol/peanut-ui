'use client'

import { type RefObject } from 'react'
import { twMerge } from 'tailwind-merge'
import Card from '@/components/Global/Card'
import { ReceiptRow } from '@/components/TransactionDetails/ReceiptRow'
import { PerkIcon } from '@/components/TransactionDetails/PerkIcon'
import { ReceiptSupportLink } from '@/components/TransactionDetails/ReceiptSupportLink'
import { type TransactionDetails } from '@/components/TransactionDetails/transactionTransformer'
import { type HistoryEntryPerkReward } from '@/services/services.types'
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
    const t = useTranslations('transaction')
    const tCommon = useTranslations('common')
    const formatDate = useReceiptDateFormatter()

    return (
        <div ref={contentRef} className={twMerge('flex flex-col gap-4', className)}>
            {/* head (board composition): centered icon → type line → amount →
                badge. Completed = base state, no badge (states board). */}
            <div className="flex flex-col items-center gap-4 text-center">
                <PerkIcon size="medium" />
                <div className="flex w-full flex-col items-center gap-2">
                    <div className="flex w-full flex-col items-center gap-1">
                        <h2 className="text-body-s text-foreground-secondary">{t('perk.title')}</h2>
                        <p className="text-heading-l text-foreground-primary">{amountDisplay}</p>
                    </div>
                    {transaction.status !== 'completed' &&
                        (transaction.status === 'pending' || transaction.status === 'processing' ? (
                            <span className="rounded-round bg-background-badge-attention px-3 py-1 text-label-m text-foreground-primary">
                                {tCommon('status.processing')}
                            </span>
                        ) : (
                            <span className="rounded-round bg-background-badge-helper px-3 py-1 text-label-m text-foreground-primary">
                                {tCommon(
                                    (transaction.status && STATUS_LABEL_KEYS[transaction.status]) ?? 'status.unknown'
                                )}
                            </span>
                        ))}
                    <p className="text-body-s text-foreground-secondary">{t('perk.subtitle')}</p>
                </div>
            </div>

            {/* Perk details — date + reason. Reason has a payment-UUID suffix
                stripped because PerkUsage uses it for idempotency (purchase-
                listener.ts) and shouldn't surface to users. Backend follow-up:
                add requestPaymentUuid column so reason can be clean. */}
            <Card position="single" className="divide-y divide-dashed divide-border-default px-4 py-0">
                <ReceiptRow label={t('perk.received')} value={formatDate(new Date(transaction.date))} />
                <ReceiptRow
                    label={t('rows.reason')}
                    value={perkRewardData.reason.replace(/\s*\(payment:\s*[a-f0-9-]+\)/i, '')}
                />
            </Card>

            <ReceiptSupportLink />
        </div>
    )
}
