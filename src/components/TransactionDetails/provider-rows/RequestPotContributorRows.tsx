'use client'

import AvatarWithBadge from '@/components/Profile/AvatarWithBadge'
import { UserAvatar } from '@/components/Avatar/UserAvatar'
import { type ReceiptViewModel } from '@/components/TransactionDetails/useReceiptViewModel'
import { formatCurrency, printableUserHandle } from '@/utils/general.utils'

/**
 * Contributors block for request-pot receipts (Activity/Request board
 * 17835:83962): avatar + name + amount per row.
 * Renders inside ReceiptDetailsCard's `divide-y` as one dashed-divided
 * section.
 *
 * The amount is what the contributor paid, which can be less than their own
 * charge asked (TASK-23856). What the charge asked is the payer's figure, so
 * the requester's receipt does not show it.
 */
export function RequestPotContributorRows({ vm }: { vm: ReceiptViewModel }) {
    const { requestPotContributors } = vm
    if (requestPotContributors.length === 0) return null

    return (
        <div className="flex w-full flex-col gap-2 pt-2 pb-3" translate="no">
            {requestPotContributors.map((contributor) => (
                <div key={contributor.uuid} className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                        {contributor.isPeanutUser && contributor.person ? (
                            <UserAvatar person={contributor.person} size="s" decorative />
                        ) : (
                            /* AvatarWithBadge derives the per-username colors
                               itself when none are passed */
                            <AvatarWithBadge name={contributor.username ?? ''} size="s" />
                        )}
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
