import { useTranslations } from 'next-intl'
import StatusBadge, { type StatusType } from '@/components/Global/Badges/StatusBadge'
import { daysSince, lastUsedTone, type LastUsedTone } from '@/utils/saved-address.utils'

// Recency → DS badge semantics: recent = success, aging = attention. Stale is
// GREY, not error — red reads as "something is wrong", grey as "not
// necessarily current" (exchanges rotate deposit addresses). StatusBadge has
// no grey status, so stale overrides to the helper grey (DS
// `background-badge-helper`; `bg-grey-2` until feat/design-system lands).
const TONE_BADGE: Record<LastUsedTone, { status: StatusType; className?: string }> = {
    recent: { status: 'completed' },
    aging: { status: 'pending' },
    stale: { status: 'custom', className: 'bg-grey-2 text-grey-1' },
}

/** "Used today / 3 days ago" pill; tone = how long since the last withdraw to this address. */
export default function LastUsedPill({ lastUsedAt, className }: { lastUsedAt: string; className?: string }) {
    const t = useTranslations('global')
    const days = daysSince(lastUsedAt)
    const tone = lastUsedTone(days)
    const badge = TONE_BADGE[tone]
    return (
        <span data-tone={tone} className={className}>
            <StatusBadge
                status={badge.status}
                size="small"
                className={badge.className}
                customText={t('savedAddresses.lastUsed', { days })}
            />
        </span>
    )
}
