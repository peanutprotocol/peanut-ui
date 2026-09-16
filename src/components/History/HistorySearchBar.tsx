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
    /** a date range is applied — the filter button carries the active tint */
    isFilterActive: boolean
}

/**
 * Search field plus the filter entry point above the activity list.
 *
 * The search half is UI only for now — the query stays in local state and
 * filters nothing. When it gets wired it moves to nuqs like every other
 * filter (URL-as-state), so the query survives refresh and is shareable.
 */
export const HistorySearchBar = ({ onOpenFilters, isFilterActive }: HistorySearchBarProps) => {
    const t = useTranslations('history')
    const [query, setQuery] = useState('')

    return (
        <div className="flex w-full items-center gap-2">
            <SearchInput
                className="flex-1"
                value={query}
                onChange={setQuery}
                onClear={() => setQuery('')}
                placeholder={t('search.placeholder')}
                aria-label={t('search.placeholder')}
            />
            {/* icon-only button: 40px box + 20px icon, hit area extended to 44px */}
            <Button
                variant="transparent"
                onClick={onOpenFilters}
                aria-label={t('range.title')}
                data-testid="history-filters"
                className={twMerge(
                    'relative size-10 w-10 shrink-0 p-0 shadow-none after:absolute after:-inset-0.5',
                    isFilterActive && 'text-action-primary'
                )}
            >
                <Icon name="list-filter" size={20} />
            </Button>
        </div>
    )
}
