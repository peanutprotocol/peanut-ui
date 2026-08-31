'use client'

import { useTranslations } from 'next-intl'
import AvatarWithBadge from '@/components/Profile/AvatarWithBadge'
import { type ReceiptViewModel } from '@/components/TransactionDetails/useReceiptViewModel'
import { formatCurrency, printableUserHandle } from '@/utils/general.utils'

/**
 * Contributors block for request-pot receipts (Activity/Request board
 * 17835:83962): "Contributors (N)" then avatar + name + amount per row.
 * Renders inside ReceiptDetailsCard's `divide-y` as one dashed-divided
 * section.
 */
export function RequestPotContributorRows({ vm }: { vm: ReceiptViewModel }) {
    const t = useTranslations('transaction')
    const { requestPotContributors } = vm
    if (requestPotContributors.length === 0) return null

    return (
        <div className="flex w-full flex-col gap-2 py-3" translate="no">
            <span className="text-body-s text-foreground-secondary">
                {t('contributors', { count: requestPotContributors.length })}
            </span>
            {requestPotContributors.map((contributor) => (
                <div key={contributor.uuid} className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                        {/* AvatarWithBadge derives the per-username colors
                            itself when none are passed */}
                        <AvatarWithBadge name={contributor.username ?? ''} size="tiny" />
                        <span className="truncate text-body-s text-foreground-primary">
                            {printableUserHandle(contributor.username ?? '')}
                        </span>
                    </div>
                    <span className="text-label-l text-foreground-primary">${formatCurrency(contributor.amount)}</span>
                </div>
            ))}
        </div>
    )
}
