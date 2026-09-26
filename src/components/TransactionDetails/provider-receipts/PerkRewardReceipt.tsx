'use client'

import { type ReactNode, type RefObject } from 'react'
import { twMerge } from '@/utils/tw'
import Card from '@/components/Global/Card'
import { DataRow } from '@/components/0_Bruddle/DataRow'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { CONCEPT_ICONS } from '@/components/0_Bruddle/conceptIcons'
import { type TransactionDetails } from '@/components/TransactionDetails/transactionTransformer'
import { type HistoryEntryPerkReward } from '@/services/services.types'
import Badge from '@/components/Global/Badges/Badge'
import { useTranslations } from 'next-intl'
import { useReceiptDateFormatter } from '@/components/TransactionDetails/useReceiptDateFormatter'
import { receiptDataRowCardClassName } from '@/components/TransactionDetails/receipt-data-row-layout'

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
    actions,
}: {
    transaction: TransactionDetails
    perkRewardData: HistoryEntryPerkReward
    amountDisplay: string
    contentRef?: RefObject<HTMLDivElement>
    className?: string
    actions: ReactNode
}) {
    const t = useTranslations('transaction')
    const formatDate = useReceiptDateFormatter()

    return (
        <div ref={contentRef} className={twMerge('flex flex-col gap-4', className)}>
            {/* head (board composition): centered icon → type line → amount →
                badge. Completed = base state, no badge (states board). */}
            <div className="flex flex-col items-center gap-3 text-center">
                <IconBubble {...CONCEPT_ICONS.rewards} size="m" />
                <div className="flex w-full flex-col items-center gap-2">
                    <div className="flex w-full flex-col items-center gap-1">
                        <h2 className="text-body-xs text-foreground-secondary">{t('perk.title')}</h2>
                        <p className="text-heading-m text-foreground-primary">{amountDisplay}</p>
                    </div>
                    {/* design.md badges: a pending reward is in progress on our side, so it
                        reads "Processing" in info blue; every other status keeps its own colour. */}
                    {transaction.status && transaction.status !== 'completed' && (
                        <Badge
                            status={transaction.status === 'pending' ? 'processing' : transaction.status}
                            size="medium"
                        />
                    )}
                    <p className="text-body-s text-foreground-secondary">{t('perk.subtitle')}</p>
                </div>
            </div>

            {/* Perk details — date + reason. Reason has a payment-UUID suffix
                stripped because PerkUsage uses it for idempotency (purchase-
                listener.ts) and shouldn't surface to users. Backend follow-up:
                add requestPaymentUuid column so reason can be clean. */}
            <Card position="solo" className={receiptDataRowCardClassName}>
                <DataRow label={t('perk.received')} value={formatDate(new Date(transaction.date))} />
                <DataRow
                    label={t('rows.reason')}
                    value={perkRewardData.reason.replace(/\s*\(payment:\s*[a-f0-9-]+\)/i, '')}
                />
            </Card>

            {actions}
        </div>
    )
}
