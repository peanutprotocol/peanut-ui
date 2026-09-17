import { useFormatter, useTranslations } from 'next-intl'
import { useHistoryRange } from './useHistoryRange'
import { startOfLocalDay } from '@/utils/historyRange.utils'

/** Human label for the active timeframe: the preset name, or a formatted
 *  custom span like "Aug 1 – Sep 14, 2026". */
export function useHistoryRangeLabel(): string {
    const t = useTranslations('history')
    const format = useFormatter()
    const { activePreset, from, to } = useHistoryRange()
    if (activePreset) return t(`range.${activePreset}`)
    if (from && to) {
        const fromLabel = format.dateTime(startOfLocalDay(from), { month: 'short', day: 'numeric' })
        const toLabel = format.dateTime(startOfLocalDay(to), { month: 'short', day: 'numeric', year: 'numeric' })
        return `${fromLabel} – ${toLabel}`
    }
    return t('range.allTime')
}
