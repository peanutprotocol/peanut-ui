'use client'

import { Button } from '@/components/0_Bruddle/Button'
import { useTranslations } from 'next-intl'
import { useHistoryRangeLabel } from '@/hooks/useHistoryRangeLabel'

/**
 * Trigger for the timeframe filter, showing the active range.
 * No board covers a filter trigger yet — composed from the stroke Button +
 * calendar icon and flagged per law 6 (see the feature PR body).
 */
export const HistoryRangeControl = ({ onClick }: { onClick: () => void }) => {
    const t = useTranslations('history')
    const label = useHistoryRangeLabel()
    return (
        <Button
            variant="stroke"
            size="small"
            icon="calendar"
            onClick={onClick}
            aria-label={t('range.title')}
            className="self-start"
        >
            {label}
        </Button>
    )
}
