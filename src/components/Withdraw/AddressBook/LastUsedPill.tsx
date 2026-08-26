import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import { daysSince, lastUsedTone, type LastUsedTone } from '@/utils/saved-address.utils'

const TONE_CLASS: Record<LastUsedTone, string> = {
    recent: 'bg-green-1 text-black',
    aging: 'bg-orange-1 text-black',
    stale: 'bg-orange-2 text-white',
}

/** "Used today / 3 days ago" pill; colour = how long since the last withdraw to this address. */
export default function LastUsedPill({ lastUsedAt, className }: { lastUsedAt: string; className?: string }) {
    const t = useTranslations('global')
    const days = daysSince(lastUsedAt)
    return (
        <span
            data-tone={lastUsedTone(days)}
            className={twMerge(
                'inline-block rounded-sm border border-n-1 px-1.5 py-0.5 text-[10px] font-bold leading-tight',
                TONE_CLASS[lastUsedTone(days)],
                className
            )}
        >
            {t('savedAddresses.lastUsed', { days })}
        </span>
    )
}
