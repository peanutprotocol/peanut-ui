'use client'

import { useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import NoDataEmptyState from '@/components/Global/EmptyStates/NoDataEmptyState'
import { type HistoryFilter } from './historyFilters.utils'

interface HistoryNoMatchesProps {
    query: string
    filter: HistoryFilter
    /** the query alone (pill lifted) still finds rows */
    hasMatchesInAll: boolean
    onClearSearch: () => void
    onShowAll: () => void
    onClearAll: () => void
}

/**
 * The filtered Activity's empty state. Says what was looked for, and offers
 * the one step most likely to bring rows back:
 * - search only → clear the search
 * - pill only → show all activity
 * - both, and the search matches under another pill → keep the search, lift the pill
 * - both, nothing anywhere → clear both
 */
export function HistoryNoMatches({
    query,
    filter,
    hasMatchesInAll,
    onClearSearch,
    onShowAll,
    onClearAll,
}: HistoryNoMatchesProps) {
    const t = useTranslations('history')
    const trimmed = query.trim()
    const hasPill = filter !== 'all'
    const filterLabel = t(`filter.${filter}`)

    const message = !trimmed
        ? t('noMatches.inFilter', { filter: filterLabel })
        : hasPill
          ? t('noMatches.queryInFilter', { query: trimmed, filter: filterLabel })
          : t('noMatches.query', { query: trimmed })

    const action = !trimmed
        ? { label: t('noMatches.showAll'), onClick: onShowAll }
        : !hasPill
          ? { label: t('clearSearch'), onClick: onClearSearch }
          : hasMatchesInAll
            ? { label: t('noMatches.searchAll'), onClick: onShowAll }
            : { label: t('noMatches.clearAll'), onClick: onClearAll }

    return (
        <div className="flex flex-col items-center gap-3 py-8 text-center" data-testid="history-no-matches">
            <NoDataEmptyState message={message} />
            {trimmed && <p className="text-body-s text-foreground-secondary">{t('noMatches.hint')}</p>}
            <Button variant="secondary" size="small" className="w-fit" onClick={action.onClick}>
                {action.label}
            </Button>
        </div>
    )
}
