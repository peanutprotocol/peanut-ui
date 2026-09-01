'use client'

import { useTranslations } from 'next-intl'
import { type TransactionDetails } from '@/components/TransactionDetails/transactionTransformer'
import { formatCurrency } from '@/utils/general.utils'

/**
 * Request-pot progress row for the receipt card (Activity/Request board
 * 17835:83951): "$X contributed / $Y remaining" + slim bar. Renders nothing
 * when no goal is set — no-goal pots already show "$X collected" as the head
 * amount. Renders inside ReceiptDetailsCard's `divide-y`.
 */
export function RequestPotProgressRow({ transaction }: { transaction: TransactionDetails }) {
    const tGlobal = useTranslations('global')

    const potGoal = transaction.isRequestPotLink ? Number(transaction.amount) : 0
    const potCollected = Number(transaction.totalAmountCollected ?? 0)
    if (!transaction.isRequestPotLink || potGoal <= 0) return null

    return (
        <div className="flex w-full flex-col gap-2 py-3">
            <div className="flex items-center justify-between text-body-s">
                <span className="text-foreground-primary">
                    {tGlobal('progressBar.contributed', { amount: `$${formatCurrency(potCollected.toString())}` })}
                </span>
                <span className="text-foreground-secondary">
                    {tGlobal('progressBar.remaining', {
                        amount: `$${formatCurrency(Math.max(potGoal - potCollected, 0).toString())}`,
                    })}
                </span>
            </div>
            {/* ponytail: native <progress> as the slim board bar (17835:83956) —
                no inline style, ratchet-clean; the legacy coin-marker
                ProgressBar is off-board for receipts */}
            <progress
                className="h-1 w-full appearance-none overflow-hidden rounded-round bg-background-disabled [&::-moz-progress-bar]:bg-action-primary [&::-webkit-progress-bar]:bg-background-disabled [&::-webkit-progress-value]:bg-action-primary"
                value={Math.min(potCollected, potGoal)}
                max={potGoal}
            />
        </div>
    )
}
