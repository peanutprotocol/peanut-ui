import { useTranslations } from 'next-intl'
import StatusBadge, { type StatusType } from '@/components/Global/Badges/StatusBadge'
import { daysSince, lastUsedTone, type LastUsedTone } from '@/utils/saved-address.utils'

// Recency → the DS status semantics (success / attention / error) so the pill
// takes the design-system badge tokens rather than its own palette.
const TONE_STATUS: Record<LastUsedTone, StatusType> = {
    recent: 'completed',
    aging: 'pending',
    stale: 'failed',
}

/** "Used today / 3 days ago" pill; tone = how long since the last withdraw to this address. */
export default function LastUsedPill({ lastUsedAt, className }: { lastUsedAt: string; className?: string }) {
    const t = useTranslations('global')
    const days = daysSince(lastUsedAt)
    const tone = lastUsedTone(days)
    return (
        <span data-tone={tone} className={className}>
            <StatusBadge status={TONE_STATUS[tone]} size="small" customText={t('savedAddresses.lastUsed', { days })} />
        </span>
    )
}
