'use client'

import { useTranslations } from 'next-intl'
import AvatarWithBadge from '@/components/Profile/AvatarWithBadge'
import { UserAvatar } from '@/components/Avatar/UserAvatar'
import Badge from '@/components/Global/Badges/Badge'
import { type ReceiptViewModel } from '@/components/TransactionDetails/useReceiptViewModel'
import { formatCurrency, printableUserHandle } from '@/utils/general.utils'

/**
 * Contributors block for request-pot receipts (Activity/Request board
 * 17835:83962): "Contributors (N)" then avatar + name + amount per row.
 * Renders inside ReceiptDetailsCard's `divide-y` as one dashed-divided
 * section.
 *
 * The amount is what the contributor paid. A contribution paid short of its
 * own charge adds the partly-paid badge and the asked amount under it, the
 * badge style the bank-transfer notice uses for the same state.
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
                        {contributor.isPeanutUser ? (
                            <UserAvatar
                                name={contributor.username ?? ''}
                                avatarKey={contributor.avatarKey}
                                size="xs"
                                decorative
                            />
                        ) : (
                            /* AvatarWithBadge derives the per-username colors
                               itself when none are passed */
                            <AvatarWithBadge name={contributor.username ?? ''} size="xs" />
                        )}
                        <span className="truncate text-body-s text-foreground-primary">
                            {printableUserHandle(contributor.username ?? '')}
                        </span>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                        <span className="text-label-l text-foreground-primary">
                            ${formatCurrency(contributor.amount)}
                        </span>
                        {contributor.isPartial && (
                            <div className="flex items-center gap-1">
                                <Badge status="pending" customText={t('contributorPartlyPaid')} />
                                <span className="text-body-xs text-foreground-secondary">
                                    {t('contributorAskedAmount', {
                                        amount: `$${formatCurrency(contributor.askedAmount)}`,
                                    })}
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            ))}
        </div>
    )
}
