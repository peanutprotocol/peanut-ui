'use client'

import { parseAsString, useQueryStates } from 'nuqs'
import { isHistoryFilter, normalizeSearchText, type HistoryFilter } from './historyFilters.utils'

/**
 * Activity search + pill state, held in the URL (`?q=&type=`) so a filtered
 * feed deep-links and survives the drawer's `?tx=` round trip. Replace, not
 * push: each keystroke would otherwise become a back-button step.
 */
export function useHistoryFilters() {
    const [{ q, type }, setParams] = useQueryStates(
        { q: parseAsString.withDefault(''), type: parseAsString.withDefault('all') },
        { history: 'replace' }
    )
    const activeFilter: HistoryFilter = isHistoryFilter(type) ? type : 'all'

    return {
        searchQuery: q,
        activeFilter,
        isFiltering: activeFilter !== 'all' || normalizeSearchText(q) !== '',
        setSearchQuery: (query: string) => setParams({ q: query || null }),
        setFilter: (filter: HistoryFilter) => setParams({ type: filter === 'all' ? null : filter }),
        clearFilters: () => setParams({ q: null, type: null }),
    }
}
