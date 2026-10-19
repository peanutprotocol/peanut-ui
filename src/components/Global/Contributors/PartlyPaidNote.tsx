'use client'

import { useTranslations } from 'next-intl'
import Badge from '@/components/Global/Badges/Badge'

/**
 * Under a contributor's amount when their payment arrived short of their
 * charge (TASK-23856): the "Partly paid" badge, in the same pending style as
 * the bank-transfer notice's part payment, and what the charge asked.
 * The receipt rows and the payer's contributors drawer both show it.
 */
export function PartlyPaidNote({
    askedAmount,
    formatAmount,
}: {
    /** What the contributor's charge asked for, as a decimal string. */
    askedAmount: string
    /** The amount format of the row this note sits under. */
    formatAmount: (amount: string) => string
}) {
    const t = useTranslations('transaction')
    return (
        <div className="flex items-center gap-1">
            <Badge status="pending" customText={t('contributorPartlyPaid')} />
            <span className="text-body-xs text-foreground-secondary">
                {t('contributorAskedAmount', { amount: formatAmount(askedAmount) })}
            </span>
        </div>
    )
}
