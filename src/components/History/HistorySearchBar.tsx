'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import { Icon } from '@/components/Global/Icons/Icon'
import { SearchInput } from '@/components/SearchInput'
import { twMerge } from '@/utils/tw'

interface HistorySearchBarProps {
    /** opens the date-filter drawer */
    onOpenFilters: () => void
    /** a date range is applied — the filter icon carries the active tint */
    isFilterActive: boolean
}

/**
 * Search field for the activity list, with the date-filter entry point at its
 * right end.
 *
 * The search half is UI only for now — the query stays in local state and
 * filters nothing. When it gets wired it moves to nuqs like every other
 * filter (URL-as-state), so the query survives refresh and is shareable.
 */
export const HistorySearchBar = ({ onOpenFilters, isFilterActive }: HistorySearchBarProps) => {
    const t = useTranslations('history')
    const [query, setQuery] = useState('')

    return (
        <SearchInput
            className="w-full"
            value={query}
            onChange={setQuery}
            onClear={() => setQuery('')}
            placeholder={t('search.placeholder')}
            aria-label={t('search.placeholder')}
            trailing={
                // clear-button anatomy: 24px box, 16px icon, hit area extended
                // to 48px tall within its own column
                <Button
                    variant="transparent"
                    onClick={onOpenFilters}
                    aria-label={t('range.title')}
                    data-testid="history-filters"
                    className="relative w-fit p-0 after:absolute after:-inset-x-1 after:-inset-y-3"
                >
                    <div className="flex size-6 items-center justify-center">
                        <Icon
                            name="list-filter"
                            size={16}
                            className={twMerge('text-foreground-secondary', isFilterActive && 'text-action-primary')}
                        />
                    </div>
                </Button>
            }
        />
    )
}
