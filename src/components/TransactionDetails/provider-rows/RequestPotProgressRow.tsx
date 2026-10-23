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
    // A settled request has nothing left to pay, even when it closed a few cents
    // short in USD: a request asked in another currency settles on what was sent.
    const isSettled = transaction.status === 'completed'
    // in whole cents: $99.16 − $73.65 is 25.509999… in floating point, and the
    // label truncates, so it read "$25.50"
    const potRemaining = isSettled ? 0 : Math.max(Math.round((potGoal - potCollected) * 100) / 100, 0)
    // A closed request takes no more money: what is left is not "remaining",
    // nobody can pay it any more (TASK-23856).
    const isClosedShort = transaction.status === 'closed'

    return (
        <div className="flex w-full flex-col gap-2 py-3">
            <div className="flex items-center justify-between text-body-s">
                <span className="text-foreground-primary">
                    {tGlobal('progressBar.contributed', { amount: `$${formatCurrency(potCollected.toString())}` })}
                </span>
                <span className="text-foreground-secondary">
                    {tGlobal(isClosedShort ? 'progressBar.notPaid' : 'progressBar.remaining', {
                        amount: `$${formatCurrency(potRemaining.toString())}`,
                    })}
                </span>
            </div>
            {/* ponytail: native <progress> as the slim board bar (17835:83956) —
                no inline style, ratchet-clean; the legacy coin-marker
                ProgressBar is off-board for receipts */}
            <progress
                className="h-1 w-full appearance-none overflow-hidden rounded-full bg-background-disabled [&::-moz-progress-bar]:bg-action-primary [&::-webkit-progress-bar]:bg-background-disabled [&::-webkit-progress-value]:bg-action-primary"
                value={isSettled ? potGoal : Math.min(potCollected, potGoal)}
                max={potGoal}
            />
        </div>
    )
}
